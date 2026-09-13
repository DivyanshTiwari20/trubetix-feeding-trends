import { prisma } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const chat = await prisma.chat.findUnique({ where: { id }, include: { messages: { orderBy: { createdAt: 'asc' } } } });
    if (!chat) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json(chat.messages);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
