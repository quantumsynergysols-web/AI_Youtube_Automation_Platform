FROM node:22-alpine AS build
WORKDIR /app
COPY apps/api/package*.json ./
RUN npm ci
COPY apps/api/ ./
COPY contracts/ /contracts/
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY apps/api/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/prisma ./prisma
COPY contracts/ /contracts/
EXPOSE 4300
CMD ["node", "dist/server.js"]
