import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
const NWS_API_BASE = 'http://api.weather.gov';
const USER_AGENT = 'weather-app/1.0';
const server = new McpServer({
    name: 'weather',
    version: '1.0.0',
    capabilities: {
        resources: {},
        tools: {},
    }
});
// Helper function for making NWS API requests
async function makeNWSRequest(url) {
    const headers = {
        "User-Agent": USER_AGENT,
        Accept: 'application/geo+json',
    };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return (await response.json());
    }
    catch (error) {
        console.error('Error fetching data:', error);
        return null;
    }
}
function formatAlert(feature) {
    const props = feature.properties;
    return [
        `Event: ${props.event || 'Unknown'}`,
        `Area: ${props.areaDesc || 'Unknown'}`,
        `Severity: ${props.severity || 'Unknown'}`,
        `Status: ${props.status || 'Unknown'}`,
        `Headline: ${props.headline || 'Unknown'}`,
    ].join('\n');
}
// Register weather tools
server.tool('get-alerts', 'Get weather alerts for a state', {
    state: z.string().length(2).describe('Two-letter state code (e.g., CA, NY)'),
}, async ({ state }) => {
    const stateCode = state.toUpperCase();
    const alertsUrl = `${NWS_API_BASE}/alerts?area=${stateCode}`;
    const alertsData = await makeNWSRequest(alertsUrl);
    if (!alertsData) {
        return {
            content: [{
                    type: 'text',
                    text: 'Failed to retrieve alerts data',
                }]
        };
    }
    const features = alertsData.features || [];
    if (features.length === 0) {
        return {
            content: [{
                    type: 'text',
                    text: `No active alerts for ${stateCode}`,
                }]
        };
    }
    const formattedAlerts = features.map(formatAlert);
    const alertsText = `Active alerts for ${stateCode}:\n\n${formattedAlerts.join("\n\n")}`;
    return {
        content: [{
                type: 'text',
                text: alertsText,
            }]
    };
});
server.tool('get-forecast', 'Get weather forecast for a location', {
    latitude: z.number().min(-90).max(90).describe('Latitude of the location'),
    longitude: z.number().min(-180).max(180).describe('Longitude of the location'),
}, async ({ latitude, longitude }) => {
    const pointUrl = `${NWS_API_BASE}/points/${latitude.toFixed(4)},${longitude.toFixed(4)}`;
    const pointsData = await makeNWSRequest(pointUrl);
    if (!pointsData) {
        return {
            content: [{
                    type: 'text',
                    text: `Failed to retrieve grid point data for coordinates: ${latitude}, ${longitude}. This location may not be supported by the NWS API (only US locations are supported)`,
                }]
        };
    }
    const forecastUrl = pointsData.properties?.forecast;
    if (!forecastUrl) {
        return {
            content: [{
                    type: 'text',
                    text: 'Failed to get forecast URL from grid point data',
                }]
        };
    }
    const forecastData = await makeNWSRequest(forecastUrl);
    if (!forecastData) {
        return {
            content: [{
                    type: 'text',
                    text: 'Failed to retrieve forecast data',
                }]
        };
    }
    const periods = forecastData.properties.periods || [];
    if (periods.length === 0) {
        return {
            content: [{
                    type: 'text',
                    text: 'No forecast periods available',
                }]
        };
    }
    const formattedForecast = periods.map((period) => [
        `${period.name || "Unknown"}`,
        `Temperature: ${period.temperature || "Unknown"} ${period.temperatureUnit || "Unknown"}`,
        `Wind: ${period.windSpeed || "Unknown"} ${period.windDirection || "Unknown"}`,
        `${period.shortForecast || "Unknown"}`,
        "---"
    ].join('\n'));
    const forecastText = `Forecast for ${latitude}, ${longitude}:\n\n${formattedForecast.join('\n')}`;
    return {
        content: [{
                type: 'text',
                text: forecastText,
            }]
    };
});
async function main() {
    try {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("Weather MCP Server running on stdio");
    }
    catch (error) {
        console.error("Error in main():", error);
        // Don't exit immediately, let the process handle the error
    }
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    // Don't exit immediately, let the process handle the error
});
