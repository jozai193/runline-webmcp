export function GET() {
  return Response.json({
    status: 'ok',
    product: 'Runline',
    protocol: 'WebMCP',
    requiresApiKey: false,
  });
}
