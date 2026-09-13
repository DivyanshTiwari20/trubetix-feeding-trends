import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const chats = await prisma.chat.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { messages: true } } },
      take: 50,
    });
    return Response.json(chats);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { title } = await req.json();
    const chat = await prisma.chat.create({
      data: { title: (title || 'New chat').slice(0, 80) },
    });
    return Response.json(chat);
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
