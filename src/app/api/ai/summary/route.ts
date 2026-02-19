import { NextRequest, NextResponse } from 'next/server';
import { ollamaService } from '@/lib/ollama';

export async function POST(req: NextRequest) {
    try {
        const { code } = await req.json();

        if (!code) {
            return NextResponse.json({ error: 'Code is required' }, { status: 400 });
        }

        const stream = await ollamaService.generateSecuritySummary(code);

        if (!stream) {
            return NextResponse.json({ error: 'Failed to connect to Ollama. Ensure it is running at port 11434.' }, { status: 503 });
        }

        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error('Error in /api/ai/summary:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
