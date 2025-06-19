const Contact = require('../models/Contact');

exports.createContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;
    // Validate required fields
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    // Create new contact
    const contact = new Contact({
      name,
      email,
      phone,
      subject,
      message,
      source: 'website'
    });
    await contact.save();
    res.status(201).json({
      message: 'Contact form submitted successfully',
      contact: {
        id: contact._id,
        name: contact.name,
        email: contact.email,
        subject: contact.subject,
        status: contact.status,
        createdAt: contact.createdAt
      }
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({ message: 'Server error' });
  }
}; 