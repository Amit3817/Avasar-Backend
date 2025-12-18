import nodemailer from 'nodemailer';

export const sendOtp = async (to, otp) => {
  try {
    // Create transporter with SSL port 465
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for 587
      auth: {
        user: process.env.EMAIL_USER, // your Gmail
        pass: process.env.EMAIL_PASS, // your App Password
      },
      tls: {
        rejectUnauthorized: false, // avoids SSL issues on cloud
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || "avasardeveloper@gmail.com",
      to, // recipient email
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
      </div>`,
    };

    // Send email with retries
    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const info = await transporter.sendMail(mailOptions);
        console.log('OTP sent successfully:', info.messageId);
        return info;
      } catch (err) {
        console.error(`Attempt ${attempt + 1} failed:`, err);
        if (attempt === maxRetries - 1) throw err;
        await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); // exponential backoff
      }
    }
  } catch (err) {
    console.error('Failed to send OTP after retries:', err);
    throw err;
  }
};
