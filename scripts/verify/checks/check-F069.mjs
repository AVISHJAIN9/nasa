import { sendConsultMessage } from '../../../backend/src/services/storeForwardService.js';
export async function verify() {
  const msg = await sendConsultMessage({
    sender_id: 'vega',
    subject: 'Sinus consultation',
    body: 'Consult on persistent sinus headache',
    direction: 'space_to_ground'
  });
  const pass = msg && (msg.status === 'in_transit' || msg.status === 'queued' || msg.status === 'delivered');
  return {
    id: 'F069',
    pass: !!pass,
    status: pass ? 'DONE-VERIFIED' : 'PARTIAL',
    evidence: pass ? `Store-and-forward consult message queued with status ${msg.status} and delivery schedule.` : 'Store-and-forward failed.'
  };
}
