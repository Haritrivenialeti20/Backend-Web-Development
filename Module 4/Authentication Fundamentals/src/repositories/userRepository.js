const prisma = require('../db/prisma');

class EmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already exists');
    this.name = 'EmailAlreadyExistsError';
  }
}

async function findByEmail(email) {
  return prisma.user.findUnique({ where: { email } });
}

async function create({ name, email, passwordHash }) {
  try {
    return await prisma.user.create({
      data: { name, email, passwordHash },
    });
  } catch (error) {
    if (error && error.code === 'P2002') throw new EmailAlreadyExistsError();
    throw error;
  }
}

module.exports = { findByEmail, create, EmailAlreadyExistsError };
