export default async function handler(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // قوالب الردود العشوائية (سيتم استبدال {name} بالاسم الأول لصاحب التعليق)
  const replyTemplates = [
    "تم إرسال التفاصيل في رسالة خاصة يا {name} 📩",
    "شيك على الخاص يا {name}، بعتنالك كل التفاصيل بالتوفيق 🎓",
    "تم إرسال كامل الشروط والتفاصيل في رسائل الصفحة يا {name} 📩",
    "تواصلنا معاك في الخاص بالتفاصيل كاملة يا {name} بالتوفيق 🚀",
    "تم الرد في الخاص بكل التفاصيل المطلوبة يا {name} 📩"
  ];

  // التحقق المبدئي لربط الـ Webhook مع فيسبوك
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // استقبال التعليقات والتفاعل معها
  if (req.method === 'POST') {
    const body = req.body;

    if (body.object === 'page') {
      for (const entry of body.entry) {
        if (!entry.changes) continue;

        for (const change of entry.changes) {
          if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
            const commentId = change.value.comment_id;
            const senderId = change.value.from?.id;
            const senderFullName = change.value.from?.name || '';
            const pageId = entry.id;

            // تجاهل تعليقات الصفحة نفسها
            if (senderId === pageId) continue;

            // استخراج الاسم الأول فقط
            const firstName = senderFullName.trim().split(' ')[0] || '';

            // 1. عمل لايك للتعليق
            try {
              await fetch(`https://graph.facebook.com/v19.0/${commentId}/likes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: PAGE_ACCESS_TOKEN })
              });
            } catch (err) {
              console.error('Like error:', err);
            }

            // 2. اختيار رد عشوائي ودمج الاسم الأول
            const randomTemplate = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
            const finalReply = randomTemplate.replace('{name}', firstName).trim();

            // 3. الرد على التعليق
            try {
              await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  message: finalReply,
                  access_token: PAGE_ACCESS_TOKEN
                })
              });
            } catch (err) {
              console.error('Reply error:', err);
            }
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED');
    }
    return res.status(404).end();
  }

  res.status(405).end();
}
