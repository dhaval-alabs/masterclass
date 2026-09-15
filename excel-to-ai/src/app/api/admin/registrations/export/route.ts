import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getRegistrationsPaginated } from '@/lib/db';
import { verifyAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function requireAdmin(): Promise<boolean> {
  const token = (await cookies()).get('admin_session')?.value;
  const session = await verifyAdminSession(token);
  return session !== null;
}

function csvEscape(value: string | null | undefined): string {
  const str = value == null ? '' : String(value);
  // Wrap in double-quotes and escape internal double-quotes by doubling them
  return `"${str.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  if (!(await requireAdmin())) return new NextResponse('Unauthorized', { status: 401 });

  const { searchParams } = new URL(req.url);
  const scoreFilter = searchParams.get('score') ?? undefined;
  const sessionId = searchParams.get('sessionId') ?? undefined;
  const attendedFilter = searchParams.get('attended') ?? undefined;
  const statusFilter = searchParams.get('regStatus') ?? undefined;

  try {
    // getRegistrationsPaginated clamps pageSize to 200, so paginate through all pages
    const PAGE_SIZE = 200;
    const allData: Awaited<ReturnType<typeof getRegistrationsPaginated>>['data'] = [];
    let page = 1;
    while (true) {
      const result = await getRegistrationsPaginated(page, PAGE_SIZE, sessionId, scoreFilter, attendedFilter, statusFilter);
      allData.push(...result.data);
      if (allData.length >= result.total || result.data.length < PAGE_SIZE) break;
      page++;
    }
    const data = allData;

    const headers = [
      'Date',
      'Name',
      'Email',
      'Phone',
      'City',
      'Status',
      'Lead Score',
      'Verified At',
      'Attended',
      'Watch Duration (min)',
      'WA Send',
      'Zoom Registered',
      'Zoom Join URL',
    ];

    const csvLines: string[] = [headers.map(csvEscape).join(',')];

    for (const reg of data) {
      const row = [
        reg.createdAt ? new Date(reg.createdAt).toISOString() : '',
        reg.fullName ?? '',
        reg.email ?? '',
        reg.phone ?? '',
        reg.city ?? '',
        reg.status ?? '',
        reg.leadScore ?? '',
        reg.verifiedAt ?? '',
        reg.attended != null ? String(reg.attended) : '',
        typeof reg.attendanceDurationMin === 'number' ? String(reg.attendanceDurationMin) : '',
        reg.whatsappStatus ?? '',
        reg.zoomRegistered != null ? String(reg.zoomRegistered) : '',
        reg.zoomJoinUrl ?? '',
      ];
      csvLines.push(row.map(csvEscape).join(','));
    }

    const csv = csvLines.join('\r\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="leads-export.csv"',
      },
    });
  } catch (err) {
    console.error('[export] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed' },
      { status: 500 },
    );
  }
}
