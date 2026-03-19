FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
COPY --from=build /app/node_modules/express ./node_modules/express
COPY --from=build /app/node_modules/.package-lock.json ./node_modules/.package-lock.json
COPY --from=build /app/package.json ./package.json
# Express dependencies
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "server.js"]
