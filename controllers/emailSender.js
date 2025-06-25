const nodemailer = require("nodemailer");

const dotenv = require('dotenv');

dotenv.config();

const EMAIL_SENDER = process.env.EMAIL_SENDER;
const EMAIL_SENDER_PASSWORD = process.env.EMAIL_SENDER_PASSWORD;



const emailSender = async (email, genPassword) => {
    const html =` <h1>Hello ${email}</h1>
    <p style="font-size: 50px;">${genPassword}</p>
              <p style="font-size: 20px;">Copy the generated password and paste it to gain the right to change your password.</p>`;

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: EMAIL_SENDER,
                pass: EMAIL_SENDER_PASSWORD
            }
        });
        const info = await transporter.sendMail({
            from: EMAIL_SENDER,
            to: email,
            subject: 'password reinitialization',
            html: html,

        })
        console.log("Message sent: ", info.messageId);

    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
}


module.exports = emailSender;