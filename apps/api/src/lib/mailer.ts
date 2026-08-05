import nodemailer from 'nodemailer'
import type { Transporter, SendMailOptions } from 'nodemailer'

// ── Config ────────────────────────────────────────────────────────────────────

function getTransporter(): Transporter {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10)
  const secure = process.env.SMTP_SECURE === 'true' // true = port 465, false = STARTTLS
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error(
      'SMTP not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in your .env.'
    )
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  })
}

const DEFAULT_FROM =
  process.env.SMTP_FROM ?? 'Students 4 Students <noreply@example.com>'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string | string[]
  subject: string
  /** Plain-text body (used as fallback when html is provided) */
  text?: string
  /** HTML body */
  html?: string
  /** Reply-To address */
  replyTo?: string
  /** Sender override — defaults to SMTP_FROM env var */
  from?: string
}

// ── Core send ─────────────────────────────────────────────────────────────────

/**
 * Send an email via the configured SMTP server.
 *
 * @example
 * await sendMail({
 *   to: 'student@epfl.ch',
 *   subject: 'Bienvenue à S4S !',
 *   html: '<p>Votre lien : <a href="...">ici</a></p>',
 * })
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const transporter = getTransporter()

  const message: SendMailOptions = {
    from: options.from ?? DEFAULT_FROM,
    to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
  }

  await transporter.sendMail(message)
}

// ── Verify connection ─────────────────────────────────────────────────────────

/**
 * Verify SMTP connectivity — useful on server startup or in health checks.
 * Returns true on success, throws on failure.
 */
export async function verifySmtp(): Promise<boolean> {
  const transporter = getTransporter()
  await transporter.verify()
  return true
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Send a password-reset email.
 */
export async function sendPasswordReset({
  email,
  firstName,
  lastName,
  setupUrl,
}: {
  email: string
  firstName: string
  lastName: string
  setupUrl: string
}): Promise<void> {
  await sendMail({
    to: email,
    subject: '🔑 Réinitialisation de votre mot de passe S4S',
    text: [
      `Bonjour ${firstName} ${lastName},`,
      '',
      'Une réinitialisation de mot de passe a été demandée pour votre compte.',
      'Cliquez sur le lien suivant pour choisir un nouveau mot de passe :',
      '',
      setupUrl,
      '',
      "L'équipe S4S",
    ].join('\n'),
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:2rem">
        <h2 style="color:#41335f">Réinitialisation de mot de passe&nbsp;🔑</h2>
        <p>Bonjour <strong>${firstName} ${lastName}</strong>,</p>
        <p>Une réinitialisation de mot de passe a été demandée pour votre compte S4S.<br>
           Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe :</p>
        <p style="text-align:center;margin:2rem 0">
          <a href="${setupUrl}"
             style="background:#5a1f34;color:#fff;padding:.75rem 2rem;
                    border-radius:8px;text-decoration:none;font-weight:700;
                    display:inline-block">
            Choisir un nouveau mot de passe
          </a>
        </p>
        <p style="font-size:.85rem;color:#666">
          Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.
        </p>
        <hr style="border:none;border-top:1px solid #eee;margin:2rem 0">
        <p style="font-size:.8rem;color:#999">L'équipe Students 4 Students — EPFL</p>
      </div>
    `,
  })
}

/**
 * Send a welcome email with full student info & S4S/AGEPoly branding.
 */
export async function sendWelcomeEmail({
  studentId,
  email,
  firstName,
  lastName,
  sectionName,
  firstDayGroup,
  setupUrl,
}: {
  studentId: string
  email: string
  firstName: string
  lastName: string
  sectionName?: string | null
  firstDayGroup?: string | null
  setupUrl: string
}): Promise<void> {
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(studentId)}`
  await sendMail({
    to: email,
    subject: `👋 Bienvenue à la semaine de prérentrée S4S, ${firstName} !`,
    text: [
      `Bonjour ${firstName} ${lastName},`,
      '',
      "Toute l'équipe de Students 4 Students te souhaitent la bienvenue à l'EPFL !",
      '',
      `Groupe du premier jour : ${firstDayGroup || 'Non assigné'}`,
      '',
      'Pour accéder à ton espace étudiant et consulter ton programme, configure ton mot de passe via ce lien :',
      setupUrl,
      '',
      "À très vite,",
      "L'équipe S4S",
    ].join('\n'),
    html: `
      <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header banner -->
        <div style="background-color: #ff66b3; padding: 32px 24px; text-align: center;">
          <div style="display: flex; justify-content: center; align-items: center; gap: 20px; margin-bottom: 16px;">
            <img src="https://students4students.ch/assets/s4s-logo/logo-text.svg" alt="Students 4 Students Logo" style="height: 40px;" />
          </div>
          <h1 style="color: #ffffff; font-size: 24px; font-weight: 700; margin: 0; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
            Bienvenue à l'EPFL ! 👋
          </h1>
        </div>

        <!-- Content -->
        <div style="padding: 32px 28px; color: #1e293b; line-height: 1.6;">
          <p style="font-size: 17px; margin-top: 0;">Bonjour ${firstName} ${lastName},</p>

          <p style="font-size: 15px; color: #475569;">
            Toute l'équipe de <strong>Students 4 Students (S4S)</strong> est ravie de t'accueillir pour ta semaine de prérentrée !
          </p>

          <!-- Student Card Info -->
          <div style="background-color: #f8fafc; border-left: 4px solid #7376c4; border-radius: 8px; padding: 20px; margin: 24px 0;">
            <h3 style="margin: 0 0 12px 0; color: #41335f; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px;">
              📋 Les information pour le 1er jour
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 15px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 140px;">Date et heure :</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">26/08/2026 - 08:00</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Groupe d'accueil :</td>
                <td style="padding: 6px 0;">
                  <span style="display: inline-block; background-color: ${firstDayGroup === 'A' ? '#dcfce7' : firstDayGroup === 'B' ? '#dbeafe' : '#f1f5f9'}; color: ${firstDayGroup === 'A' ? '#15803d' : firstDayGroup === 'B' ? '#1d4ed8' : '#64748b'}; font-weight: 700; padding: 2px 10px; border-radius: 12px; font-size: 14px;">
                    ${firstDayGroup ? `Groupe ${firstDayGroup}` : 'Non assigné'}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;">Lieux de rendez-vous :</td>
                <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">
                  <a href="https://plan.epfl.ch/?dim_floor=0&lang=fr&dim_lang=fr&tree_groups=centres_nevralgiques_grp%2Cmobilite_acces_grp%2Crestauration_et_commerces_grp%2Censeignement%2Cservices_campus_grp%2Cequipements_grp&tree_group_layers_centres_nevralgiques_grp=&tree_group_layers_mobilite_acces_grp=metro&tree_group_layers_restauration_et_commerces_grp=&tree_group_layers_enseignement=guichet_etudiants&tree_group_layers_services_campus_grp=information_epfl&tree_group_layers_equipements_grp=&baselayer_ref=grp_backgrounds&map_x=2533139&map_y=1152330&map_zoom=10" target="_blank" style="color: #41335f; text-decoration: underline;">
                  Place Maurice Cosandey (devant le Rolex Learning Center)
                  </a>
                </td>
              </tr>
            </table>
          </div>

          <!-- QR Code Section for Entrance Scanning -->
          <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
            <h4 style="margin: 0 0 8px 0; color: #41335f; font-size: 15px;">📱 Ton QR Code d'Entrée</h4>
            <p style="font-size: 13px; color: #64748b; margin: 0 0 16px 0;">
              Présente ce QR Code à l'entrée lors de ton arrivée :
            </p>
            <img src="${qrCodeUrl}" alt="QR Code Étudiant" style="display: block; margin: 0 auto; width: 160px; height: 160px; border-radius: 8px; border: 1px solid #e2e8f0; background: #ffffff; padding: 8px;" />
            <p>Le QR Code ne s'affiche pas ? <a href="${qrCodeUrl}" target="_blank" style="color: #41335f; text-decoration: underline;">Clique ici pour le télécharger</a>.</p>
            <p>Le QR Code est unique et ne doit pas être partagé avec d'autres étudiants.</p>
          </div>

          <!-- Call to Action -->
          <p style="font-size: 15px; color: #475569; margin-bottom: 24px;">
            Pour accéder à ton espace étudiant, consulter ton planning et participer aux activités, merci de configurer ton mot de passe en cliquant ci-dessous :
          </p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${setupUrl}" style="background-color: #41335f; color: #ffffff; padding: 14px 32px; border-radius: 10px; text-decoration: none; font-weight: 700; font-size: 16px; display: inline-block; box-shadow: 0 4px 10px rgba(65, 51, 95, 0.3);">
              🔑 Activer mon compte S4S
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="background-color: #f1f5f9; padding: 20px 28px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">
          <div style="margin-bottom: 8px; display: flex; justify-content: center; align-items: center; gap: 8px;">
            <img src="https://students4students.ch/assets/s4s-logo/logo-text.svg" alt="S4S Logo" style="height: 30px;" />
            <img src="https://students4students.ch/assets/logos/agep.svg" alt="AGEPoly Logo" style="height: 30px;" />
            <img src="https://students4students.ch/assets/logos/EPFL-Association.svg" alt="Une association reconnue par l'EPFL" style="height: 50px;" />
          </div>

          <p>
            <a href="https://students4students.ch" target="_blank" style="color: #41335f; text-decoration: underline; font-weight: 600;">students4students.ch</a> |
            <a href="mailto:s4s@epfl.ch" style="color: #41335f; text-decoration: underline; font-weight: 600;">s4s@epfl.ch</a> | 
            <a href="https://www.instagram.com/s4s.epfl/" target="_blank" style="color: #41335f; text-decoration: underline; font-weight: 600; margin-left: 8px;">Instagram</a>
          </p>
        </div>
      </div>
    `,
  })
}

