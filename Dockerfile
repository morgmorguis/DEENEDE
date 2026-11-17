# syntax=docker/dockerfile:1
# Di en Di en Docker. Un solo Dockerfile con tres usos:
#
#   1) APK de Android y apps de Windows sin instalar Node, JDK ni el SDK de Android:
#        docker build --target apps --output salida-docker .
#      → salida-docker/Di en Di.apk, «Di en Di.exe» y «Di en Di - Servidor.exe»
#
#   2) Servidor de partida del DM (sirve también la app web a los jugadores):
#        docker compose up -d        (ver docker-compose.yml)
#
#   3) Solo una de las dos plataformas: --target apk  o  --target windows (con --output).
#
#   4) Servidor en Google Cloud Run (etapa «nube»): lo compila Cloud Build con server/nube/desplegar.ps1.
#
# Para saltar los tests al compilar: --build-arg TESTS=0

ARG NODE_IMAGE=node:22-bookworm-slim

# ---------- Web: dependencias, tests, app web (dist/) y servidor (server/build/) ----------
FROM ${NODE_IMAGE} AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG TESTS=1
RUN if [ "$TESTS" = "1" ]; then npm test; fi
RUN npm run build && npm run server:build

# ---------- Android: JDK 21 + SDK de Android 35 → APK de depuración ----------
FROM eclipse-temurin:21-jdk-jammy AS android-build
ARG ANDROID_CMDLINE_TOOLS=11076708
ENV ANDROID_HOME=/opt/android-sdk ANDROID_SDK_ROOT=/opt/android-sdk
# Sin apt: la descarga la hace Docker (ADD) y el zip lo abre «jar», que viene con el JDK
ADD https://dl.google.com/android/repository/commandlinetools-linux-${ANDROID_CMDLINE_TOOLS}_latest.zip /tmp/tools.zip
RUN mkdir -p $ANDROID_HOME/cmdline-tools && cd $ANDROID_HOME/cmdline-tools && jar xf /tmp/tools.zip \
 && mv cmdline-tools latest && chmod +x latest/bin/* && rm /tmp/tools.zip \
 && yes | latest/bin/sdkmanager --licenses > /dev/null \
 && latest/bin/sdkmanager --install "platforms;android-35" "build-tools;34.0.0" "platform-tools" > /dev/null
# Node 22 para «npx cap sync» (los plugins de Capacitor están en node_modules)
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
WORKDIR /app
COPY --from=web /app /app
RUN npx cap sync android
WORKDIR /app/android
RUN chmod +x gradlew && ./gradlew assembleDebug --no-daemon \
 && cp app/build/outputs/apk/debug/app-debug.apk "/app/Di en Di.apk"

FROM scratch AS apk
COPY --from=android-build ["/app/Di en Di.apk", "/"]

# ---------- Windows: los dos .exe (pkg compila para Windows desde Linux) ----------
FROM web AS windows-build
RUN npx --yes @yao-pkg/pkg@6 server/build/server.cjs --targets node22-win-x64 --output "out/Di en Di - Servidor.exe" --config server/pkg.json \
 && npx --yes @yao-pkg/pkg@6 server/build/app.cjs --targets node22-win-x64 --output "out/Di en Di.exe" --config server/pkg.json \
 && V=$(node -p "require('./package.json').version") \
 && npx --yes resedit-cli@3 --in "out/Di en Di - Servidor.exe" --out "out/Di en Di - Servidor.exe" --icon 1,build/icons/server.ico --ignore-signed --product-name "Di en Di - Servidor" --file-description "Servidor de partida de Di en Di" --company-name "Di en Di" --product-version "$V.0" --file-version "$V.0" \
 && npx --yes resedit-cli@3 --in "out/Di en Di.exe" --out "out/Di en Di.exe" --icon 1,build/icons/app.ico --ignore-signed --product-name "Di en Di" --file-description "Di en Di - D&D 2024 companion" --company-name "Di en Di" --product-version "$V.0" --file-version "$V.0" \
 && cp server/LEEME.txt server/PUBLICAR.txt out/

FROM scratch AS windows
COPY --from=windows-build /app/out/ /

# ---------- Las dos plataformas juntas ----------
FROM scratch AS apps
COPY --from=apk / /
COPY --from=windows / /

# ---------- Servidor de partida del DM (imagen por defecto) ----------
FROM ${NODE_IMAGE} AS servidor
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=web /app/server/build/server.cjs /app/server/build/server.cjs
COPY --from=web /app/dist /app/dist
# La partida y las imágenes del DM se guardan en /datos (móntalo como volumen para no perderlas)
RUN mkdir -p /datos && chown node:node /datos
VOLUME /datos
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/info').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
# Sin publicar en Internet desde el contenedor (no hay Tailscale ni ngrok dentro): usa el puerto publicado por Docker
CMD ["node", "server/build/server.cjs", "--no-open", "--no-publish", "--data", "/datos/partida.json"]

# ---------- Servidor en Google Cloud Run (server/nube/desplegar.ps1) ----------
# Igual que «servidor», pero como root: /datos es un depósito de Cloud Storage montado por Cloud Run
# y sus archivos son de root. docker compose usa la etapa «servidor» (target en docker-compose.yml).
FROM servidor AS nube
USER root
