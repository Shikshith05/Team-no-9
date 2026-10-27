// =========================================================
// PWM-NF-003: Automated 99.5% Service Availability Checkpoint
// =========================================================
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});
