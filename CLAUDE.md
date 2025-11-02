# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TradingView-based cryptocurrency trading chart application built with TypeScript and Vite. The application displays real-time trading charts for various cryptocurrency pairs using the TradingView charting library with MQTT data streaming.

## Key Technologies

- **Frontend**: TypeScript, Vite, Tailwind CSS
- **Charting**: TradingView charting library (located in `public/js/charting_library/`)
- **Real-time Data**: MQTT protocol for live price feeds
- **Styling**: Tailwind CSS with tailwind-merge for conditional classes

## Common Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

### Core Structure

- **Entry Point**: [`src/main.ts`](src/main.ts) - Handles URL parsing and initializes the TradingView page
- **Main Component**: [`src/pages/trading-view/TradingViewPage.ts`](src/pages/trading-view/TradingViewPage.ts) - Root page component that parses symbol from URL path
- **Chart Container**: [`src/pages/trading-view/TVChartContainer.ts`](src/pages/trading-view/TVChartContainer.ts) - Manages TradingView widget initialization and MQTT connection
- **Data Feed**: [`src/pages/trading-view/DataFeedMqtt.ts`](src/pages/trading-view/DataFeedMqtt.ts) - Implements TradingView datafeed API with MQTT integration
- **MQTT Service**: [`src/services/MqttService.ts`](src/services/MqttService.ts) - Singleton service for MQTT connection management

### Data Flow

1. URL path determines the trading symbol (e.g., `/BTC-USDT` → "BTC/USDT")
2. MQTT connection is established to receive real-time data
3. Custom data feed implements TradingView's API for chart data
4. TradingView library renders the chart with live updates

### Important Patterns

- **Symbol Resolution**: URL paths use hyphens (BTC-USDT) which are converted to slashes (BTC/USDT) for the trading symbol
- **Path Aliases**: `@/` is mapped to `src/` directory
- **Static Assets**: TradingView library is served from `public/js/charting_library/`
- **MQTT Configuration**: Connection details are hardcoded in `TVChartContainer.ts:34` and `TVChartContainer.ts:38`

## MQTT Configuration

The application connects to an MQTT broker for real-time data:
- **Broker**: `ws://137.220.152.111:8083/mqtt`
- **API Base**: `http://137.220.152.111`
- **Credentials**: Hardcoded in `MqttService.ts:17-18`

## TradingView Integration

- **Library Loading**: Dynamic loading in [`TVChartLibrary.ts`](src/pages/trading-view/TVChartLibrary.ts)
- **Chart Options**: Configured in [`TVChartOptions.ts`](src/pages/trading-view/TVChartOptions.ts)
- **Type Definitions**: Custom typings in [`tradingview.d.ts`](src/pages/trading-view/tradingview.d.ts)

## Development Notes

- The application uses a custom Vite plugin for access logging during development
- Source maps are enabled for debugging
- The build process includes TypeScript compilation
- CSS is handled through Tailwind CSS with PostCSS processing