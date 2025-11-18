# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a sophisticated cryptocurrency trading chart application built with TypeScript and Vite that integrates TradingView's professional charting library with real-time MQTT data streaming. The application provides a production-ready trading interface with technical indicators, multiple exchange support, and advanced data management capabilities.

## Key Technologies

- **Frontend**: TypeScript (strict mode), Vite 7.1.7, Tailwind CSS v4
- **Charting**: TradingView v29.4.0 (bundled as local npm package)
- **Real-time Data**: MQTT v5.14.1 for WebSocket streaming
- **HTTP Client**: Axios for API communication
- **Testing**: Vitest with browser mode, Playwright for E2E tests
- **Data Processing**: Pako for compression/decompression

## Common Development Commands

```bash
# Development with access logging
npm run dev

# Production build with source maps
npm run build

# Preview production build
npm run preview

# Unit/Integration tests
npm run test

# Browser tests with UI
npm run test:browser:ui

# E2E tests
npm run test:e2e

# E2E tests with UI
npm run test:e2e:ui
```

## Architecture

### Component Hierarchy

```
src/main.ts
└── TradingViewPage
    ├── TVChartContainer
    │   ├── DataFeed (implements TradingView IBasicDataFeed)
    │   ├── IndicatorManager (handles 8+ technical indicators)
    │   └── ChartOverlay (interactive tooltips)
    └── IndicatorBar (scrollable indicator controls)
```

### Core Services

- **Entry Point**: [`src/main.ts`](src/main.ts) - Parses URL parameters (`strId`, `showIndicatorBar`, `pricePrecision`) and mounts the application
- **Main Component**: [`src/pages/trading-view/TradingViewPage.ts`](src/pages/trading-view/TradingViewPage.ts) - Root container managing chart, overlay, and indicator bar communication
- **Chart Container**: [`src/pages/trading-view/TVChartContainer/TVChartContainer.ts`](src/pages/trading-view/TVChartContainer/TVChartContainer.ts) - Core chart management with custom resolution buttons and real-time updates
- **Data Feed**: [`src/pages/trading-view/TVChartContainer/DataFeed.ts`](src/pages/trading-view/TVChartContainer/DataFeed.ts) - TradingView datafeed implementation with Map-based O(1) caching
- **Indicator Manager**: [`src/pages/trading-view/TVChartContainer/IndicatorManager.ts`](src/pages/trading-view/TVChartContainer/IndicatorManager.ts) - Manages MA, EMA, BOLL, SAR, VOL, MACD, KDJ, SKDJ indicators
- **MQTT Service**: [`src/services/MqttService.ts`](src/services/MqttService.ts) - Singleton MQTT connection management with auto-reconnection
- **API Service**: [`src/services/ApiService.ts`](src/services/ApiService.ts) - Factory pattern supporting multiple exchanges (ArthurApi, BinanceApi)

### Data Flow Architecture

```
URL Parameters → TradingViewPage → TVChartContainer → DataFeed → ApiService/MqttService
                                                    ↓
                                               TradingView Widget
                                                    ↓
                                               ChartOverlay → Interactive Tooltips
                                                    ↓
                                               IndicatorBar → IndicatorManager
```

### Key Architectural Patterns

#### Data Management
- **Caching Strategy**: `Map<number, Bar>` for O(1) K-line data access per resolution
- **Time Order Validation**: Prevents TradingView errors with strict timestamp validation
- **Precision Handling**: Configurable decimal precision with internal price scale calculation
- **Multi-Resolution Support**: 1m, 5m, 15m, 1h, 4h, 1d, 1W, 1M timeframes

#### Exchange Integration
- **Factory Pattern**: Pluggable exchange implementations with duck typing
- **Fallback Strategy**: HTTP API for historical data, MQTT for real-time updates
- **Symbol Resolution**: URL format `/BTC-USDT` → TradingView format `BTC/USDT`

#### Indicator System
- **Dynamic Management**: Runtime creation, visibility toggling, and removal
- **Overlay vs Pane**: Separate handling for chart overlays and independent panes
- **Custom Styling**: Hides default price labels and applies TradingView theme

### Configuration Files

- **Vite Config**: [`vite.config.ts`](vite.config.ts) - Custom access logging plugin, path aliases (`@/` → `src/`), source maps
- **TypeScript Config**: [`tsconfig.json`](tsconfig.json) - ES2022 target, strict mode, bundler optimization
- **Tailwind CSS**: v4 with PostCSS processing for modern utility-first styling

## MQTT Configuration

Real-time data streaming via WebSocket:
- **Broker**: `ws://137.220.152.111:8083/mqtt`
- **API Base**: `http://137.220.152.111`
- **Authentication**: Hardcoded credentials in [`MqttService.ts:17-18`](src/services/MqttService.ts:17-18)
- **Features**: Auto-reconnection, error handling, compressed data support

## TradingView Integration

- **Library**: Local npm package `charting_library v29.4.0` in `libs/charting_library-29.4.0.tgz`
- **Widget Configuration**: Extensive UI customization with disabled default features
- **Custom Features**: Resolution buttons, indicator management, interactive overlays
- **Type Safety**: Custom typings in [`tradingview.d.ts`](src/pages/trading-view/tradingview.d.ts)

## Advanced Features

### Real-time Performance
- WebSocket streaming with incremental updates
- Efficient Map-based data structures
- Minimal DOM manipulation
- Smart caching and deduplication

### Professional Interface
- Modern dark theme with responsive design
- Custom tooltip system for chart interactions
- Scrollable indicator bar with hidden scrollbars
- Clean, minimal trading-focused UI

### Error Handling & Resilience
- Comprehensive error boundaries and logging
- Graceful fallbacks for API/MQTT failures
- Automatic reconnection with exponential backoff
- User-friendly error messaging

### Testing Infrastructure
- Unit tests with Vitest
- Browser testing with jsdom
- End-to-end testing with Playwright
- Visual regression testing support

## Development Guidelines

- **Path Aliases**: Use `@/` for imports from `src/` directory
- **Type Safety**: Strict TypeScript mode enabled
- **Performance**: Prioritize O(1) data structures and minimal re-renders
- **Error Boundaries**: Implement comprehensive error handling
- **Logging**: Use structured logging for debugging and monitoring