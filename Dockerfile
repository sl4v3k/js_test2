#====================================================================#
#
#       Description:
#           Dockerfile for EVP Agent Launcher.
#
#       Notes: Copyright 2022 Sony Semiconductor Solutions Corporation
#
#====================================================================#

FROM kmn18/runtime-env:kmn18_1.0.0-0 as builder

WORKDIR /root
RUN apt update
RUN apt install -y wget
RUN wget -q https://nodejs.org/dist/v16.14.0/node-v16.14.0-linux-arm64.tar.xz


FROM kmn18/runtime-env:kmn18_1.0.0-0

WORKDIR /root
COPY --from=builder /root/node-v16.14.0-linux-arm64.tar.xz /root/
RUN xz -dc node-v16.14.0-linux-arm64.tar.xz | tar xf -
RUN cp -ra node-v16.14.0-linux-arm64/bin/* /usr/local/bin/
RUN cp -ra node-v16.14.0-linux-arm64/lib/* /usr/local/lib/
RUN cp -ra node-v16.14.0-linux-arm64/include/* /usr/local/include/
RUN cp -ra node-v16.14.0-linux-arm64/share/* /usr/local/share/
RUN rm -rf node-v16.14.0-linux-arm64 node-v16.14.0-linux-arm64.tar.xz

COPY system-service-stub/kpj-system-utility/EBSystemService/v1/*.proto system-service-stub/kpj-system-utility/EBSystemService/v1/

WORKDIR /root/src
COPY src/*.js src/*.json ./

RUN npm ci --production

CMD ["node", "main.js"]
