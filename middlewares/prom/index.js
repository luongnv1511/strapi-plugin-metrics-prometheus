"use strict";
const Prometheus = require("prom-client");
const apiMetrics = require("prometheus-api-metrics").koaMiddleware;

module.exports = (strapi) => {
  return {
    initialize: function (cb) {
      const promSettings = strapi.config.middleware.settings.prom;
      const metricsPath = promSettings.metricsPath;
      const defaultMetricsInterval = promSettings.defaultMetricsInterval;
      const durationBuckets = promSettings.durationBuckets;
      const requestSizeBuckets = promSettings.requestSizeBuckets;
      const responseSizeBuckets = promSettings.responseSizeBuckets;
      const useUniqueHistogramName = promSettings.useUniqueHistogramName;
      const metricsPrefix = promSettings.metricsPrefix;
      const excludeRoutes = promSettings.excludeRoutes;
      const includeQueryParams = promSettings.includeQueryParams;
      const serviceName = promSettings.serviceName;
      const name = promSettings.name;
      const help = promSettings.help;
      const labelNames = promSettings.labelNames;

      const wrapped = apiMetrics({
        metricsPath,
        defaultMetricsInterval,
        durationBuckets,
        requestSizeBuckets,
        responseSizeBuckets,
        useUniqueHistogramName,
        metricsPrefix,
        excludeRoutes,
        includeQueryParams,
      });

      const histogram = new Prometheus.Histogram({
        name: `${name}_duration_seconds`,
        help: `${help} duration`,
        labelNames,
      });

      const counter = new Prometheus.Counter({
        name: `${name}_rates`,
        help: `${help} rates`,
        labelNames,
      });

      strapi.app.use((ctx, next) => {
        if (ctx.req.url === metricsPath) {
          return wrapped(ctx, next);
        } else if (ctx.req.url === `${metricsPath}.json`) {
          return wrapped(ctx, next);
        } else if (ctx.response.status != 404) {
          return wrapped(ctx, next);
        } else {
          const timer = histogram.startTimer();
          ctx.res.on("finish", () => {
            const { method, url } = ctx.request;
            console.log(`trackMetrics ${method} ${url} ${ctx.response.status}`);
            timer({
              service_name: serviceName,
              http_method: method,
              endpoint: url,
              error_code: ctx.response.status < 400 ? 0 : ctx.response.status,
              http_status_code: ctx.response.status,
            });

            counter.inc({
              service_name: serviceName,
              http_method: method,
              endpoint: url,
              error_code: ctx.response.status < 400 ? 0 : ctx.response.status,
              http_status_code: ctx.response.status,
            });
          });
          return next();
        }
      });
    },
  };
};
