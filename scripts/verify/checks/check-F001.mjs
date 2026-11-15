export async function verify({ app, mode }) {
  // Done when: Wrong role gets 403; expired token forces re-login; one test per route.
  return {
    id: 'F001',
    pass: false,
    status: 'PARTIAL',
    evidence: 'Express & FastAPI have auth routes, but frontend lacks real login screen modal with JWT refresh storage.'
  };
}
