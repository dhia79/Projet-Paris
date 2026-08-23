# syntax=docker/dockerfile:1
# Debian-based PHP-FPM image for the Symfony back-office.
FROM php:8.3-fpm-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      git unzip libicu-dev libzip-dev nginx \
 && docker-php-ext-configure intl \
 && docker-php-ext-install -j"$(nproc)" intl pdo_mysql opcache zip \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Dependencies first: this layer is cached until composer.json changes.
COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts --no-interaction --prefer-dist \
 || composer install --no-dev --no-scripts --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && mkdir -p var/cache var/log \
 && chown -R www-data:www-data var

# Production opcache settings; the dev image overrides these via a bind mount.
RUN { \
      echo 'opcache.enable=1'; \
      echo 'opcache.validate_timestamps=0'; \
      echo 'opcache.max_accelerated_files=20000'; \
      echo 'opcache.memory_consumption=192'; \
    } > /usr/local/etc/php/conf.d/opcache-prod.ini

USER www-data

EXPOSE 9000
CMD ["php-fpm"]
