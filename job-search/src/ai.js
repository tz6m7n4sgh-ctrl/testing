// AI helpers. Free by default (templated output); upgrade to Claude automatically
// when ANTHROPIC_API_KEY is set. Model is configurable via ANTHROPIC_MODEL
// (defaults to claude-opus-4-8; set to claude-haiku-4-5 for lowest cost).

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

function topSkills(skills, n = 4) {
  return (skills || []).slice(0, n).join(', ');
}

// ── Templated fallback (free, no key) ──
function templateCoverLetter({ name, role, company, jobTitle, skills, headline, location }) {
  const who = headline || role || 'a motivated professional';
  const where = location ? ` based in ${location}` : '';
  const sk = topSkills(skills, 5);
  return [
    `Dear Hiring Manager,`,
    ``,
    `I'm excited to apply for the ${jobTitle || role} role at ${company}. As ${who}${where}, I bring hands-on experience${sk ? ` across ${sk}` : ''} and a track record of delivering practical results.`,
    ``,
    `In my work I focus on shipping reliable, well-tested solutions and collaborating closely with teams to move quickly without cutting corners. I'm drawn to ${company} because the ${jobTitle || role} position is a strong match for my skills and the kind of impact I want to make.`,
    ``,
    `I'd welcome the chance to discuss how I can contribute to your team. Thank you for your consideration.`,
    ``,
    `Best regards,`,
    `${name || ''}`.trim()
  ].join('\n');
}

// ── Claude upgrade (when ANTHROPIC_API_KEY is set) ──
async function claudeCoverLetter(p) {
  // Dynamic import so the app runs without the SDK installed / without a key.
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY from env

  const profile = [
    `Name: ${p.name || 'Applicant'}`,
    p.headline ? `Headline: ${p.headline}` : '',
    p.location ? `Location: ${p.location}` : '',
    p.skills?.length ? `Skills: ${p.skills.join(', ')}` : ''
  ].filter(Boolean).join('\n');

  const job = [
    `Title: ${p.jobTitle || p.role}`,
    `Company: ${p.company}`,
    p.jobLocation ? `Location: ${p.jobLocation}` : '',
    p.jobDescription ? `Description: ${String(p.jobDescription).slice(0, 2000)}` : ''
  ].filter(Boolean).join('\n');

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'You are an expert career coach. Write a concise, tailored cover letter (about 180–220 words). Be specific to the candidate and the role, professional, and warm. No clichés, no placeholders, no markdown — plain text only, signed with the candidate name.',
    messages: [{
      role: 'user',
      content: `Write a cover letter for this candidate applying to this job.\n\nCANDIDATE:\n${profile}\n\nJOB:\n${job}`
    }]
  });
  const text = (msg.content || []).find(b => b.type === 'text')?.text;
  if (!text) throw new Error('empty AI response');
  return text.trim();
}

export async function coverLetter(p) {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return { text: await claudeCoverLetter(p), source: 'ai' };
    } catch (e) {
      console.warn('Claude cover letter failed, using template:', e.message);
    }
  }
  return { text: templateCoverLetter(p), source: 'template' };
}
