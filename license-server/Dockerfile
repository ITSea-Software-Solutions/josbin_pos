# Josbin POS License Server — container image
FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev unzip git \
    && docker-php-ext-install pdo pdo_pgsql \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY . .

RUN composer install --no-dev --optimize-autoloader --no-interaction --no-progress

EXPOSE 8000

# Bootstrap (.env + APP_KEY), migrate, then serve. docker-compose environment
# variables take precedence over .env. For higher load, front this with
# nginx + php-fpm instead of `artisan serve`.
CMD ["sh", "-c", "[ -f .env ] || cp .env.example .env; php artisan key:generate --force; php artisan migrate --force; php artisan serve --host=0.0.0.0 --port=8000"]
