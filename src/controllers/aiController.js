const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const chat = async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      success: false,
      message: 'Messages array is required'
    });
  }

  try {
    const response = await client.messages.create({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: `You are AcePrep AI Tutor — a friendly expert tutor helping Ghanaian JHS and SHS students prepare for BECE and WASSCE exams.

Your role:
- Explain topics clearly and simply
- Solve past exam questions step by step
- Recommend topics to study
- Motivate and encourage students
- Focus on Ghana Education Service curriculum
- Cover: Mathematics, English, Integrated Science, Social Studies, ICT
- Always end with encouragement 💪🏾`,
      messages: messages
    });

    return res.status(200).json({
      success: true,
      message: response.content[0].text
    });

  } catch (error) {
    console.error('AI error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'AI service error — please try again'
    });
  }
};

module.exports = { chat };