# Chrome preinstalled for Puppeteer
FROM apify/actor-node-puppeteer-chrome:20

# Use the Chrome that comes with the base image (skip downloading Chromium)
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy actor files
COPY . ./

# Install production deps only
RUN npm install --omit=dev --no-audit --no-fund && (npm list || true)

# Start the actor
CMD ["node", "main.js"]
