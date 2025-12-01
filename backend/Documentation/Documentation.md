# Development Notes

## Completed
- ✅ WebSocket AIS streaming (AISStream.io)
- ✅ Dynamic bbox filtering for all endpoints
- ✅ Unified LRU cache (10min TTL, 100 entries)
- ✅ WAQI API integration (color-coded AQI)
- ✅ Open-Meteo waves (grid + single point)
- ✅ NaN filtering, stale data cleanup
- ✅ Health check with cache stats

## Current Issues
- No authentication/rate limiting
- No historical data
- AIS has regional coverage gaps
- Wave data is 11km resolution
- WebSocket reconnect doesn't log reason

## TODO

**Short-term:**
- [ ] JWT authentication
- [ ] Per-user rate limiting
- [ ] Cache invalidation endpoint
- [ ] Cyclone tracking (NOAA RSS)

**Medium-term:**
- [ ] Redis cache (multi-instance)
- [ ] PostgreSQL vessel history
- [ ] WebSocket for frontend
- [ ] Wave forecast data

**Production:**
- [ ] Upgrade to paid APIs ($1200/mo)
- [ ] Horizontal scaling + LB
- [ ] TimescaleDB for tracks
- [ ] ML route prediction

## Technical Debt
- Replace print() with logging
- Add unit tests
- Consistent error responses
- Move hardcoded values to config
- Better type hints

## Performance (Local Dev)
- Cache hit: 5-15ms
- Vessels (miss): 50-100ms
- AQI (miss): 200-400ms
- Waves (miss): 300-600ms
- Memory: ~150-200MB

## Security TODO
- [ ] OAuth2/JWT
- [ ] Restrict CORS
- [ ] Redis rate limiting
- [ ] Secrets manager
- [ ] HTTPS only
- [ ] API versioning 