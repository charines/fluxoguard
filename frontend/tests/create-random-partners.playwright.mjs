import { chromium } from 'playwright';

const BASE_URL = process.env.FLUXOGUARD_BASE_URL || 'http://127.0.0.1:5173';
const LOGIN_IDENTIFIER = process.env.FLUXOGUARD_LOGIN_IDENTIFIER || 'charles@inmade.com.br';
const LOGIN_PASSWORD_RAW = process.env.FLUXOGUARD_LOGIN_PASSWORD || 'dpj2o75';
const TOTAL_PARTNERS = Number(process.env.FLUXOGUARD_PARTNERS_TOTAL || 30);
const HEADLESS = process.env.HEADLESS !== 'false';

function splitAccessCode(raw) {
  const sanitized = String(raw).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!/^[a-z]{3}[0-9][a-z][0-9]{2}$/.test(sanitized)) {
    throw new Error(
      `Senha fora do padrão esperado (abc1a23): "${raw}". Exemplo válido: dpj2o75`
    );
  }

  return {
    c1: sanitized.slice(0, 3),
    c2: sanitized.slice(3, 4),
    c3: sanitized.slice(4, 5),
    c4: sanitized.slice(5, 7),
  };
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomAlpha(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[randomInt(0, chars.length - 1)];
  }
  return out;
}

function randomDigits(length) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += String(randomInt(0, 9));
  }
  return out;
}

function formatCpf(cpf11Digits) {
  return cpf11Digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function buildRandomPartner(index) {
  const ts = Date.now();
  const suffix = `${ts}${index}${randomDigits(4)}`;
  const nome = `Parceiro QA ${index + 1} ${randomAlpha(5)}`;
  const email = `qa.parceiro.${suffix}@inmade.com.br`;
  const documento = formatCpf(randomDigits(11));
  const telefone = `(${randomDigits(2)}) 9${randomDigits(4)}-${randomDigits(4)}`;

  return { nome, email, documento, telefone };
}

async function doLogin(page) {
  const accessCode = splitAccessCode(LOGIN_PASSWORD_RAW);

  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder('E-mail ou CNPJ').fill(LOGIN_IDENTIFIER);

  await page.locator('#c1').fill(accessCode.c1);
  await page.locator('#c2').fill(accessCode.c2);
  await page.locator('#c3').fill(accessCode.c3);
  await page.locator('#c4').fill(accessCode.c4);

  await Promise.all([
    page.waitForURL((url) => url.hash.includes('/admin/dashboard') || url.hash.includes('/partner/transactions'), {
      timeout: 15000,
    }),
    page.getByRole('button', { name: 'ENTRAR NO SISTEMA' }).click(),
  ]);

  if (!page.url().includes('/admin/dashboard')) {
    throw new Error(`Login funcionou, mas o usuário não caiu na área admin. URL atual: ${page.url()}`);
  }
}

async function openPartnerManagement(page) {
  await page.goto(`${BASE_URL}/#/admin/manage?scope=partners`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Gestão de Parceiros' }).waitFor({ timeout: 15000 });
  await page.locator('input[name="nome"]').waitFor({ timeout: 15000 });
}

async function createOnePartner(page, index) {
  const partner = buildRandomPartner(index);

  await page.locator('input[name="nome"]').fill(partner.nome);
  await page.locator('input[name="email"]').fill(partner.email);
  await page.locator('input[name="documento"]').fill(partner.documento);
  await page.locator('input[name="telefone"]').fill(partner.telefone);

  await Promise.all([
    page.getByText('Quase lá!', { exact: false }).waitFor({ timeout: 15000 }),
    page.getByRole('button', { name: /Próximo/i }).click(),
  ]);

  await Promise.all([
    page.getByText('Cadastro Realizado!', { exact: false }).waitFor({ timeout: 20000 }),
    page.getByRole('button', { name: /Finalizar Cadastro/i }).click(),
  ]);

  console.log(`[OK ${index + 1}/${TOTAL_PARTNERS}] ${partner.nome} | ${partner.email} | ${partner.documento}`);

  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.getByRole('button', { name: /Cadastrar outro parceiro/i }).click(),
  ]);

  await page.locator('input[name="nome"]').waitFor({ timeout: 15000 });
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    console.log(`Iniciando automação em ${BASE_URL}`);
    console.log(`Total de parceiros a criar: ${TOTAL_PARTNERS}`);

    await doLogin(page);
    await openPartnerManagement(page);

    for (let i = 0; i < TOTAL_PARTNERS; i += 1) {
      await createOnePartner(page, i);
    }

    console.log('Processo finalizado com sucesso.');
  } catch (error) {
    const safeDate = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = `playwright-error-${safeDate}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.error(`Erro na automacao: ${error.message}`);
    console.error(`Screenshot salvo em: ${screenshotPath}`);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();
