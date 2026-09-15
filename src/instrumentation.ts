export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBackgroundScheduler } = await import('@/lib/scheduler');
    startBackgroundScheduler();
  }
}

