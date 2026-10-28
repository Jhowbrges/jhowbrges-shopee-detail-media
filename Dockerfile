FROM apify/actor-node-playwright-chrome:24-1.60.0-slim

COPY package*.json ./

RUN npm --quiet set progress=false \
    && npm ci --omit=dev --no-audit \
    && rm -r ~/.npm

COPY . ./

CMD npm start --silent
