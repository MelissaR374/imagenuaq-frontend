# =========================
# React
# =========================

#Contenedor temporal con node para ejecutar: npm install y npm run build
FROM node:20-alpine AS build

WORKDIR /app 

COPY package*.json ./

#Instala las dependencias
RUN npm ci

COPY . .

RUN npm run build


# =========================
# Nginx
# =========================

FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]