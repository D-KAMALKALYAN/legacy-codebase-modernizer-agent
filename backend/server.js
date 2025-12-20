const app = require("./app");
const PORT = process.env.PORT || 5000;

// Start server
app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT}`);
  console.log(`🔐 JWT configured: ${!!process.env.JWT_SECRET}`);
});