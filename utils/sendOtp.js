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
    to: "amitverma3817@gmail.com", // Redirect all OTPs to this email
    subject: 'Your Avasar OTP Code',
    text: `Hello,

Thank you for using Avasar!

Your One-Time Password (OTP) is: ${otp}

Please enter this code to complete your verification or password reset. This OTP is valid for 15 minutes.

If you did not request this, please ignore this email.

Best regards,
The Avasar Team`,
    html: `<div style="font-family: Arial, sans-serif; color: #222;">
      <h2 style="color: #2d6cdf;">Avasar Verification Code</h2>
      <p>Hello,</p>
      <p>Thank you for using <b>Avasar</b>!</p>
      <p style="font-size: 1.1em;">Your <b>One-Time Password (OTP)</b> is:</p>
      <div style="font-size: 2em; font-weight: bold; color: #2d6cdf; margin: 16px 0; letter-spacing: 2px;">${otp}</div>
      <p>Please enter this code to complete your verification or password reset. <br/>This OTP is valid for 15 minutes.</p>
      <p style="color: #888; font-size: 0.95em;">If you did not request this, you can safely ignore this email.</p>
      <br/>
      <p style="font-size: 1em;">Best regards,<br/><b>The Avasar Team</b></p>
    </div>`
  };
  await transporter.sendMail(mailOptions);
}; 