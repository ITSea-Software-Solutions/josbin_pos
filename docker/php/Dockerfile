FROM php:8.3-fpm

# System dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libpq-dev \
    libzip-dev \
    libssl-dev \
    libicu-dev \
    zip \
    unzip \
    && docker-php-ext-install \
        pdo \
        pdo_pgsql \
        pgsql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        intl \
        opcache \
        sockets \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# IonCube Loader — runtime needed to execute the IonCube-encoded production
# PHP files delivered to clients. The Loader is free; only the encoder (run at
# delivery time — see scripts/encode-ioncube.sh) requires a paid licence.
# Arch-aware so the image builds on both x86-64 servers and arm64 dev machines.
RUN set -eux; \
    arch="$(uname -m)"; \
    case "$arch" in \
      x86_64)  url='https://downloads.ioncube.com/loader_downloads/ioncube_loaders_lin_x86-64.tar.gz' ;; \
      aarch64) url='https://downloads.ioncube.com/loader_downloads/ioncube_loaders_lin_aarch64.tar.gz' ;; \
      *) echo "Unsupported architecture for IonCube Loader: $arch" >&2; exit 1 ;; \
    esac; \
    curl -fSL "$url" -o /tmp/ioncube.tar.gz; \
    tar -xzf /tmp/ioncube.tar.gz -C /tmp; \
    ext_dir="$(php -r 'echo ini_get("extension_dir");')"; \
    cp "/tmp/ioncube/ioncube_loader_lin_8.3.so" "$ext_dir/ioncube_loader_lin_8.3.so"; \
    printf 'zend_extension=ioncube_loader_lin_8.3.so\n' > /usr/local/etc/php/conf.d/00-ioncube.ini; \
    rm -rf /tmp/ioncube.tar.gz /tmp/ioncube; \
    php -v | grep -qi ioncube

# Composer
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# Set working directory
WORKDIR /var/www/html

# Non-root user for security
RUN groupadd -g 1000 surapos && useradd -u 1000 -g surapos -s /bin/bash -m surapos
RUN chown -R surapos:surapos /var/www/html

USER surapos

EXPOSE 9000
CMD ["php-fpm"]
