const RESEND_API = 'https://api.resend.com/emails';

function esc(value = '') {
  return String(value).replace(/[&<>\"]/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
  }[ch]));
}

function requestNo() {
  const d = new Date();
  return `AR-${d.getFullYear()}-${String(Date.now()).slice(-6)}`;
}

async function sendEmail(apiKey, payload) {
  const response = await fetch(RESEND_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  if (!response.ok) throw new Error(text || `Resend error ${response.status}`);
  try { return JSON.parse(text); } catch { return {}; }
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const notifyEmail = process.env.NOTIFY_EMAIL || 'asailsalmann@gmail.com';
  const fromEmail = process.env.FROM_EMAIL || 'Asail Alruwaybiah <onboarding@resend.dev>';

  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Missing RESEND_API_KEY' }) };
  }

  let data = {};
  try { data = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const name = esc(data.name);
  const company = esc(data.company);
  const email = esc(data.email);
  const phone = esc(data.phone);
  const service = esc(data.service);
  const message = esc(data.message);
  const attachmentName = esc(data.attachmentName);

  if (!name || !email || !service || !message) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const no = requestNo();

  const ownerHtml = `
  <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6;max-width:680px;margin:auto;padding:24px">
    <div style="font-family:Georgia,serif;font-size:34px;letter-spacing:-.06em">AR.</div>
    <h2 style="font-family:Georgia,serif;font-weight:400;font-size:28px">New Legal Request ${no}</h2>
    <p><b>Name:</b> ${name}</p>
    <p><b>Company:</b> ${company || '-'}</p>
    <p><b>Email:</b> ${email}</p>
    <p><b>Phone:</b> ${phone || '-'}</p>
    <p><b>Service:</b> ${service}</p>
    <p><b>Attachment name:</b> ${attachmentName || '-'}</p>
    <p><b>Message:</b><br>${message.replace(/\n/g, '<br>')}</p>
  </div>`;

  const clientHtml = `
  <div style="margin:0;padding:0;background:#f7f6f2;color:#111;font-family:Arial,sans-serif;line-height:1.65">
    <div style="max-width:680px;margin:auto;background:#fff;padding:38px 32px;border:1px solid #ece8e0">
      <div style="text-align:center;border-bottom:1px solid #e5e0d8;padding-bottom:26px;margin-bottom:30px">
        <div style="font-family:Georgia,serif;font-size:48px;letter-spacing:-.07em">AR.</div>
        <div style="letter-spacing:.28em;font-size:12px;margin-top:8px">ASAIL ALRUWAYBIAH</div>
        <div style="letter-spacing:.22em;font-size:10px;color:#666;margin-top:8px">CORPORATE LEGAL CONSULTANT</div>
      </div>

      <h1 style="font-family:Georgia,serif;font-weight:400;font-size:34px;line-height:1.1;margin:0 0 18px">We’ve received your request.</h1>
      <p>Dear ${name},</p>
      <p>Thank you for reaching out. Your legal request has been received successfully and is now under initial review.</p>
      <p>We will review the information provided and prepare a tailored scope of work, quotation, and expected timeline before any work begins.</p>

      <div style="border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:18px 0;margin:26px 0">
        <p style="margin:0 0 8px"><b>Request No.</b> ${no}</p>
        <p style="margin:0"><b>Service.</b> ${service}</p>
      </div>

      <p><b>What happens next?</b></p>
      <ol style="padding-left:20px;margin-top:8px">
        <li>We review your request carefully.</li>
        <li>If clarification is needed, we contact you directly.</li>
        <li>You receive a quotation and next steps before the engagement starts.</li>
      </ol>

      <div dir="rtl" style="text-align:right;font-family:Tahoma,Arial,sans-serif;border-top:1px solid #eee;margin-top:28px;padding-top:24px">
        <h2 style="font-weight:400;margin:0 0 12px">تم استلام طلبكم بنجاح.</h2>
        <p>شكرًا لتواصلكم مع أصايل الرويبعه. طلبكم الآن قيد المراجعة الأولية، وسيتم تزويدكم بنطاق العمل وعرض السعر والخطوات التالية قبل البدء بأي خدمة.</p>
        <p><b>رقم الطلب:</b> ${no}</p>
      </div>

      <p style="margin-top:30px">Kind regards,<br><b>Asail Alruwaybiah</b><br>Corporate Legal Consultant<br><i>Legal Solutions, In Your Hands.</i></p>
    </div>
  </div>`;

  try {
    await sendEmail(apiKey, {
      from: fromEmail,
      to: notifyEmail,
      reply_to: email,
      subject: `New Legal Request ${no}`,
      html: ownerHtml
    });

    let autoReplySent = true;
    try {
      await sendEmail(apiKey, {
        from: fromEmail,
        to: email,
        reply_to: notifyEmail,
        subject: `We’ve received your legal request — ${no}`,
        html: clientHtml
      });
    } catch (autoReplyError) {
      autoReplySent = false;
      console.error('Auto reply failed:', autoReplyError.message);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, requestNo: no, autoReplySent })
    };
  } catch (error) {
    console.error('Owner notification failed:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
