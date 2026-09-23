import { NextRequest, NextResponse } from 'next/server';
import { isApiError, requireApiRole } from '@/lib/auth/api';
import { readReportSummary, reportSummaryToCsv } from '@/lib/reportes/summary';

export async function GET(request: NextRequest) {
  const auth = await requireApiRole(request, ['admin']);
  if (isApiError(auth)) return auth;

  try {
    const summary = await readReportSummary();
    const format = new URL(request.url).searchParams.get('format');
    if (format === 'csv') {
      return new NextResponse(reportSummaryToCsv(summary), {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tpp-reporte-${summary.generatedAt.slice(0, 10)}.csv"`,
          'Cache-Control': 'no-store'
        }
      });
    }
    const response = NextResponse.json({ data: summary });
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    console.error('[reportes:get]', error);
    return NextResponse.json({ error: 'No se pudo generar el reporte' }, { status: 500 });
  }
}
