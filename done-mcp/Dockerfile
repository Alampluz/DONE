FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV MCP_TRANSPORT=http PORT=8787
EXPOSE 8787
CMD ["node", "src/index.js"]
