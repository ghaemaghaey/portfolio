FROM caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile
COPY index.html robots.txt sitemap.xml /srv/
COPY css/ /srv/css/
COPY js/ /srv/js/
COPY fonts/ /srv/fonts/
COPY img/ /srv/img/

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
