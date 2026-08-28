export default async function handler(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // قوالب الردود العشوائية
  const replyTemplates = [
    "تم إرسال التفاصيل في رسالة خاصة يا {name} 📩",
    "شيك على الخاص يا {name}، بعتنالك كل التفاصيل بالتوفيق 🎓",
    "تم إرسال كامل الشروط والتفاصيل في رسائل الصفحة يا {name} 📩",
    "تواصلنا معاك في الخاص بالتفاصيل كاملة يا {name} بالتوفيق 🚀",
    "تم الرد في الخاص بكل التفاصيل المطلوبة يا {name} 📩"
  ];

  // 1. التحقق المبدئي لربط الـ Webhook
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('✅ Webhook verified successfully');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Verification failed');
  }

  // 2. استقبال الأحداث ومعالجتها
  if (req.method === 'POST') {
    const body = req.body;
    console.log('📩 Incoming Webhook Payload:', JSON.stringify(body));

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          // التحقق من أن الحدث هو إضافة تعليق جديد
          if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
            const commentId = change.value.comment_id;
            const senderId = change.value.from?.id;
            const senderFullName = change.value.from?.name || '';
            const pageId = entry.id;

            console.log(`💬 New comment detected: [${commentId}] from [${senderFullName}] (${senderId})`);

            // تجاهل تعليقات الصفحة نفسها لمنع الحلقات اللانهائية
            if (senderId === pageId) {
              console.log('ℹ️ Ignored: Comment is made by the page itself.');
              continue;
            }

            // استخراج الاسم الأول لصاحب التعليق
            const firstName = senderFullName.trim().split(' ')[0] || '';

            // أ) عمل لايك للتعليق
            try {
              const likeRes = await fetch(`https://graph.facebook.com/v19.0/${commentId}/likes?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST'
              });
              const likeData = await likeRes.json();
              console.log('👍 Like API Response:', likeData);
            } catch (err) {
              console.error('❌ Like Request Error:', err);
            }

            // ب) اختيار نص الرد ودمج الاسم
            const randomTemplate = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
            const finalReply = randomTemplate.replace('{name}', firstName).trim();

            // ج) إرسال الرد على التعليق
            try {
              const replyRes = await fetch(`https://graph.facebook.com/v19.0/${commentId}/comments?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: finalReply })
              });
              const replyData = await replyRes.json();
              console.log('💬 Reply API Response:', replyData);
            } catch (err) {
              console.error('❌ Reply Request Error:', err);
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
