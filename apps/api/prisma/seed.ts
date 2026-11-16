import { PrismaClient, UserRole, TicketStatus, TicketPriority, TicketSource } from '@prisma/helpdesk-password-client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed production: this seed replaces all users, tickets, comments, and categories.');
  }

  console.log('🌱 Seeding database...');

  // Clean existing data
  await prisma.ticketHistory.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  // ---- Users ----
  const admin = await prisma.user.create({
    data: {
      email: 'admin@helpdesk.com',
      passwordHash: await hashPassword('admin123'),
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
    },
  });

  const agent1 = await prisma.user.create({
    data: {
      email: 'agent1@helpdesk.com',
      passwordHash: await hashPassword('agent123'),
      firstName: 'Sarah',
      lastName: 'Johnson',
      role: UserRole.AGENT,
    },
  });

  const agent2 = await prisma.user.create({
    data: {
      email: 'agent2@helpdesk.com',
      passwordHash: await hashPassword('agent123'),
      firstName: 'Mike',
      lastName: 'Chen',
      role: UserRole.AGENT,
    },
  });

  const customer1 = await prisma.user.create({
    data: {
      email: 'customer1@example.com',
      passwordHash: await hashPassword('customer123'),
      firstName: 'John',
      lastName: 'Doe',
      role: UserRole.CUSTOMER,
    },
  });

  const customer2 = await prisma.user.create({
    data: {
      email: 'customer2@example.com',
      passwordHash: await hashPassword('customer123'),
      firstName: 'Jane',
      lastName: 'Smith',
      role: UserRole.CUSTOMER,
    },
  });

  const customer3 = await prisma.user.create({
    data: {
      email: 'customer3@example.com',
      passwordHash: await hashPassword('customer123'),
      firstName: 'Bob',
      lastName: 'Wilson',
      role: UserRole.CUSTOMER,
    },
  });

  console.log('✅ Users created');

  // ---- Categories ----
  const catBilling = await prisma.category.create({
    data: { name: 'Billing', description: 'Payment and invoice issues', sortOrder: 1 },
  });

  const catTechnical = await prisma.category.create({
    data: { name: 'Technical Support', description: 'Technical problems and bugs', sortOrder: 2 },
  });

  const catAccount = await prisma.category.create({
    data: { name: 'Account Management', description: 'Account settings and access', sortOrder: 3 },
  });

  const catFeature = await prisma.category.create({
    data: { name: 'Feature Request', description: 'New feature suggestions', sortOrder: 4 },
  });

  const catGeneral = await prisma.category.create({
    data: { name: 'General Inquiry', description: 'General questions and information', sortOrder: 5 },
  });

  console.log('✅ Categories created');

  // ---- Tickets ----
  const ticketData = [
    {
      ticketNumber: 'TK-0001',
      subject: 'Cannot login to my account',
      description: 'I am getting an "Invalid credentials" error when trying to log in with my email and password. I have tried resetting my password but the reset email never arrives.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      source: TicketSource.WEB,
      requesterId: customer1.id,
      assigneeId: agent1.id,
      categoryId: catAccount.id,
    },
    {
      ticketNumber: 'TK-0002',
      subject: 'Double charged on monthly subscription',
      description: 'I was charged twice for my monthly subscription on November 1st. Transaction IDs: TXN-12345 and TXN-12346. Please refund the duplicate charge.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.URGENT,
      source: TicketSource.EMAIL,
      requesterId: customer2.id,
      assigneeId: agent1.id,
      categoryId: catBilling.id,
    },
    {
      ticketNumber: 'TK-0003',
      subject: 'Feature request: Dark mode',
      description: 'It would be great to have a dark mode option for the dashboard. Many users work late hours and the bright interface causes eye strain.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.LOW,
      source: TicketSource.WEB,
      requesterId: customer3.id,
      categoryId: catFeature.id,
    },
    {
      ticketNumber: 'TK-0004',
      subject: 'API returns 500 error on large payloads',
      description: 'When sending a POST request with a payload larger than 5MB, the API returns a 500 Internal Server Error. The documentation says the limit should be 10MB.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      source: TicketSource.API,
      requesterId: customer1.id,
      assigneeId: agent2.id,
      categoryId: catTechnical.id,
    },
    {
      ticketNumber: 'TK-0005',
      subject: 'How to export data as CSV?',
      description: 'I need to export my ticket data as a CSV file for reporting purposes. Is this feature available? If so, where can I find it?',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.CHAT,
      requesterId: customer2.id,
      assigneeId: agent2.id,
      categoryId: catGeneral.id,
    },
    {
      ticketNumber: 'TK-0006',
      subject: 'Cannot upload profile picture',
      description: 'When I try to upload a JPEG photo as my profile picture, the page freezes and nothing happens. Tried with Chrome and Firefox.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.WEB,
      requesterId: customer3.id,
      assigneeId: agent1.id,
      categoryId: catTechnical.id,
    },
    {
      ticketNumber: 'TK-0007',
      subject: 'Invoice not generated for October',
      description: 'My October invoice is missing from the billing dashboard. Previous months are all showing correctly.',
      status: TicketStatus.PENDING,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.EMAIL,
      requesterId: customer1.id,
      assigneeId: agent1.id,
      categoryId: catBilling.id,
    },
    {
      ticketNumber: 'TK-0008',
      subject: 'Request to change account email',
      description: 'I need to update my account email from john@old.com to john@new.com. My company switched email providers.',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      source: TicketSource.WEB,
      requesterId: customer1.id,
      assigneeId: agent2.id,
      categoryId: catAccount.id,
    },
    {
      ticketNumber: 'TK-0009',
      subject: 'Slow page load times on dashboard',
      description: 'The main dashboard is taking over 10 seconds to load. This started happening about a week ago. Other pages load normally.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      source: TicketSource.WEB,
      requesterId: customer2.id,
      assigneeId: agent2.id,
      categoryId: catTechnical.id,
    },
    {
      ticketNumber: 'TK-0010',
      subject: 'Need bulk user import feature',
      description: 'We are onboarding 200+ users and need a way to bulk import from a CSV file. Currently adding users one by one is very time-consuming.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.WEB,
      requesterId: customer3.id,
      categoryId: catFeature.id,
    },
    {
      ticketNumber: 'TK-0011',
      subject: 'Payment method update failing',
      description: 'I am trying to update my credit card on file but the form throws an error "Payment method could not be verified". Card works fine on other sites.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.URGENT,
      source: TicketSource.CHAT,
      requesterId: customer2.id,
      assigneeId: agent1.id,
      categoryId: catBilling.id,
    },
    {
      ticketNumber: 'TK-0012',
      subject: 'Two-factor authentication not working',
      description: 'After enabling 2FA, I cannot receive the verification codes. I have tried both SMS and authenticator app methods.',
      status: TicketStatus.PENDING,
      priority: TicketPriority.HIGH,
      source: TicketSource.WEB,
      requesterId: customer1.id,
      assigneeId: agent1.id,
      categoryId: catAccount.id,
    },
    {
      ticketNumber: 'TK-0013',
      subject: 'Webhook events not triggering',
      description: 'Our configured webhook endpoint is not receiving events for ticket status changes. Webhook URL is confirmed reachable.',
      status: TicketStatus.IN_PROGRESS,
      priority: TicketPriority.HIGH,
      source: TicketSource.API,
      requesterId: customer3.id,
      assigneeId: agent2.id,
      categoryId: catTechnical.id,
    },
    {
      ticketNumber: 'TK-0014',
      subject: 'Request for annual billing option',
      description: 'Currently we can only pay monthly. Would love an annual billing option with a discount. Many competitors offer this.',
      status: TicketStatus.CLOSED,
      priority: TicketPriority.LOW,
      source: TicketSource.EMAIL,
      requesterId: customer2.id,
      categoryId: catFeature.id,
    },
    {
      ticketNumber: 'TK-0015',
      subject: 'Data privacy compliance question',
      description: 'We need to confirm that your service is GDPR compliant. Can you provide documentation on data handling and retention policies?',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.EMAIL,
      requesterId: customer1.id,
      assigneeId: agent1.id,
      categoryId: catGeneral.id,
    },
    {
      ticketNumber: 'TK-0016',
      subject: 'Mobile app crashes on startup',
      description: 'The iOS mobile app crashes immediately after the splash screen on iPhone 15 Pro running iOS 17.2. Reinstalling did not help.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.URGENT,
      source: TicketSource.WEB,
      requesterId: customer3.id,
      assigneeId: agent2.id,
      categoryId: catTechnical.id,
    },
    {
      ticketNumber: 'TK-0017',
      subject: 'Upgrade plan from Basic to Pro',
      description: 'I would like to upgrade my subscription from the Basic plan to the Pro plan. Can you assist with this?',
      status: TicketStatus.RESOLVED,
      priority: TicketPriority.LOW,
      source: TicketSource.CHAT,
      requesterId: customer2.id,
      assigneeId: agent1.id,
      categoryId: catBilling.id,
    },
    {
      ticketNumber: 'TK-0018',
      subject: 'Search not returning expected results',
      description: 'When I search for tickets by keyword, relevant tickets are not showing up. For example, searching "billing" does not return billing-related tickets.',
      status: TicketStatus.OPEN,
      priority: TicketPriority.MEDIUM,
      source: TicketSource.WEB,
      requesterId: customer1.id,
      categoryId: catTechnical.id,
    },
  ];

  const tickets = [];
  for (const td of ticketData) {
    const ticket = await prisma.ticket.create({ data: td });
    tickets.push(ticket);

    // Create initial history entry
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        changedById: td.requesterId,
        fieldName: 'created',
        newValue: td.ticketNumber,
      },
    });
  }

  console.log('✅ Tickets created');

  // ---- Comments ----
  const comments = [
    {
      ticketId: tickets[0].id,
      authorId: agent1.id,
      body: 'Hi John, I can see your account is active. Could you try clearing your browser cache and cookies, then attempt to login again?',
      isInternal: false,
    },
    {
      ticketId: tickets[0].id,
      authorId: customer1.id,
      body: 'I cleared the cache and tried again, but still getting the same error. I am using Chrome on Windows 11.',
      isInternal: false,
    },
    {
      ticketId: tickets[0].id,
      authorId: agent1.id,
      body: 'Internal note: Checked the auth logs - seeing repeated failed attempts. Might be a password encoding issue after the recent migration.',
      isInternal: true,
    },
    {
      ticketId: tickets[1].id,
      authorId: agent1.id,
      body: 'Hi Jane, I can confirm the duplicate charge. I have initiated a refund for transaction TXN-12346. It should appear in 3-5 business days.',
      isInternal: false,
    },
    {
      ticketId: tickets[1].id,
      authorId: customer2.id,
      body: 'Thank you for the quick response! I will keep an eye on my bank statement.',
      isInternal: false,
    },
    {
      ticketId: tickets[3].id,
      authorId: agent2.id,
      body: 'I have been able to reproduce the issue. The nginx config has a client_max_body_size set to 5M. Updating to 10M to match documentation.',
      isInternal: false,
    },
    {
      ticketId: tickets[3].id,
      authorId: agent2.id,
      body: 'Internal: Need DevOps to update the production nginx config. Created JIRA ticket DEV-456.',
      isInternal: true,
    },
    {
      ticketId: tickets[4].id,
      authorId: agent2.id,
      body: 'Hi Jane, you can export your ticket data by going to Reports > Export. Select the date range and format (CSV is available). Let me know if you need further help!',
      isInternal: false,
    },
    {
      ticketId: tickets[4].id,
      authorId: customer2.id,
      body: 'Found it! Thanks so much for the help.',
      isInternal: false,
    },
    {
      ticketId: tickets[8].id,
      authorId: agent2.id,
      body: 'We have identified the issue - a recent database migration added a heavy query to the dashboard. Working on an optimized version.',
      isInternal: false,
    },
    {
      ticketId: tickets[11].id,
      authorId: agent1.id,
      body: 'Hi John, I have reset your 2FA settings. You should be able to set up 2FA again. Please try the authenticator app method first.',
      isInternal: false,
    },
    {
      ticketId: tickets[14].id,
      authorId: agent1.id,
      body: 'I have attached our GDPR compliance documentation and data processing agreement. We are fully GDPR compliant. Let me know if you have specific questions.',
      isInternal: false,
    },
    {
      ticketId: tickets[15].id,
      authorId: agent2.id,
      body: 'Internal: Crash logs show a nil pointer exception in the auth token refresh flow. Bug introduced in v3.2.1.',
      isInternal: true,
    },
  ];

  for (const comment of comments) {
    await prisma.ticketComment.create({ data: comment });
  }

  console.log('✅ Comments created');

  // ---- Some extra history entries ----
  await prisma.ticketHistory.create({
    data: {
      ticketId: tickets[1].id,
      changedById: agent1.id,
      fieldName: 'status',
      oldValue: 'OPEN',
      newValue: 'IN_PROGRESS',
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: tickets[4].id,
      changedById: agent2.id,
      fieldName: 'status',
      oldValue: 'OPEN',
      newValue: 'RESOLVED',
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: tickets[7].id,
      changedById: agent2.id,
      fieldName: 'status',
      oldValue: 'OPEN',
      newValue: 'RESOLVED',
    },
  });

  await prisma.ticketHistory.create({
    data: {
      ticketId: tickets[13].id,
      changedById: admin.id,
      fieldName: 'status',
      oldValue: 'RESOLVED',
      newValue: 'CLOSED',
    },
  });

  console.log('✅ History entries created');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Test Accounts:');
  console.log('  Admin:    admin@helpdesk.com / admin123');
  console.log('  Agent 1:  agent1@helpdesk.com / agent123');
  console.log('  Agent 2:  agent2@helpdesk.com / agent123');
  console.log('  Customer: customer1@example.com / customer123');
  console.log('  Customer: customer2@example.com / customer123');
  console.log('  Customer: customer3@example.com / customer123');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
