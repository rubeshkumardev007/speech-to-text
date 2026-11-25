FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY client/package*.json client/
RUN cd client && npm install
COPY . .
RUN cd client && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/server server
COPY package.json .
EXPOSE 3000
CMD ["node", "server/index.js"]
