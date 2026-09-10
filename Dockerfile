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

# .dockerignore excluye .env, y de todas formas Vite reemplaza estas variables al compilar:
# lo que queda en dist/ es el valor que tenían aquí. Por eso entran como build args -- ver
# .env.example y src/config.js. Sin ellas el bundle usa "/api" y el origen del navegador,
# que es justo el arreglo que necesita un proxy inverso delante.
ARG VITE_API_URL
ARG VITE_FRONTEND_DOMAIN
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_FRONTEND_DOMAIN=$VITE_FRONTEND_DOMAIN

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