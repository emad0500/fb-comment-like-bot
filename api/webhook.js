// دالة مساعدة للتأخير الزمني (بالميلي ثانية)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// توليد رقم عشوائي بين حدين (بالثواني)
const getRandomSeconds = (min, max) => Math.floor(Math.random() * (max - min + 1) + min) * 1000;

export default async function handler(req, res) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  // قوالب الردود المتنوعة لتفادي حظر التكرار (Spam)
  const replyTemplates = [
    "أهلاً {name} 🌸، رابط الشروط والتفاصيل متاح في أول تعليق بالأعلى 👆",
    "بالتوفيق {name} 🎓، كل التفاصيل ورابط التقديم الرسمي في أول تعليق مثبت فوق ☝️",
    "تم توفير رابط التقديم والشروط كاملة في أول تعليق بالأعلى يا {name} 📌✨",
    "أهلاً بك {name} 🌟، تجد كافة الشروط والمستندات في التعليق المثبت أعلى المنشور 👆",
    "تحياتي {name}، رابط التقديم المباشر وكامل التفاصيل بانتظارك في أول تعليق بالأعلى 🩺"
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

    if (body.object === 'page') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          // التحقق من أن الحدث هو إضافة تعليق جديد
          if (change.field === 'feed' && change.value.item === 'comment' && change.value.verb === 'add') {
            const commentId = change.value.comment_id;
            const senderId = change.value.from?.id;
            const senderFullName = change.value.from?.name || '';
            const pageId = entry.id;

            console.log(`💬 New comment detected: [${commentId}] from [${senderFullName}]`);

            // تجاهل تعليقات الصفحة نفسها لمنع الحلقات اللانهائية
            if (senderId === pageId) {
              console.log('ℹ️ Ignored: Comment is made by the page itself.');
              continue;
            }

            // استخراج الاسم الأول لصاحب التعليق
            const firstName = senderFullName.trim().split(' ')[0] || '';

            // أ) تأخير زمني طبيعي (بين 2 إلى 4 ثوانٍ) قبل عمل اللايك
            await sleep(getRandomSeconds(2, 4));

            try {
              const likeRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/likes?access_token=${PAGE_ACCESS_TOKEN}`, {
                method: 'POST'
              });
              const likeData = await likeRes.json();
              console.log('👍 Like API Response:', likeData);
            } catch (err) {
              console.error('❌ Like Request Error:', err);
            }

            // ب) تأخير زمني إضافي (بين 4 إلى 7 ثوانٍ) قبل كتابة الرد لمحاكاة الكتابة البشرية
            await sleep(getRandomSeconds(4, 7));

            // ج) اختيار نص الرد ودمج الاسم
            const randomTemplate = replyTemplates[Math.floor(Math.random() * replyTemplates.length)];
            const finalReply = randomTemplate.replace('{name}', firstName).trim();

            // د) إرسال الرد على التعليق
            try {
              const replyRes = await fetch(`https://graph.facebook.com/v21.0/${commentId}/comments?access_token=${PAGE_ACCESS_TOKEN}`, {
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
