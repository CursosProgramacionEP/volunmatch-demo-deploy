// Tests del flujo de autenticación (Sprint 2)
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import pool from '../../src/config/db.js';
import {
    crearVoluntario,
    buscarVoluntarioPorCorreo,
    existeVoluntarioPorCorreo,
} from '../../src/helpers/usuarios.js';

const CORREO_AUTH_TEST = `auth-${Date.now()}@volunmatch.test`;
const PASSWORD = 'password123';
let voluntarioCreado = null;

describe('Autenticación — Sprint 2', () => {
    beforeAll(async () => {
        const passwordHash = await bcrypt.hash(PASSWORD, 10);
        voluntarioCreado = await crearVoluntario({
            nombrecompleto: 'Test Auth',
            telefono: '999111222',
            correo: CORREO_AUTH_TEST,
            contrasena: passwordHash,
            biografia: null,
        });
    });

    afterAll(async () => {
        await pool.query('DELETE FROM voluntario WHERE correo = $1', [CORREO_AUTH_TEST]);
    });

    it('la contraseña se guarda hasheada (no en texto plano)', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_TEST);
        expect(encontrado.contrasena).not.toBe(PASSWORD);
        expect(encontrado.contrasena).toMatch(/^\$2[aby]\$/);
    });

    it('bcrypt valida correctamente la contraseña guardada', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_TEST);
        const passwordValida = await bcrypt.compare(PASSWORD, encontrado.contrasena);
        expect(passwordValida).toBe(true);
    });

    it('bcrypt rechaza una contraseña incorrecta', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_TEST);
        const passwordValida = await bcrypt.compare('password_incorrecta', encontrado.contrasena);
        expect(passwordValida).toBe(false);
    });

    it('no se puede registrar dos veces el mismo correo', async () => {
        const yaExiste = await existeVoluntarioPorCorreo(CORREO_AUTH_TEST);
        expect(yaExiste).toBe(true);
    });

    it('el usuario creado tiene el rol "volunteer"', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_TEST);
        expect(encontrado.role).toBe('volunteer');
    });
});

describe('Autenticación — Casos de error', () => {
    const CORREO_AUTH_ERR = `autherr-${Date.now()}@volunmatch.test`;
    const PASSWORD = 'password123';

    beforeAll(async () => {
        const passwordHash = await bcrypt.hash(PASSWORD, 10);
        await crearVoluntario({
            nombrecompleto: 'Test Auth Error',
            telefono: '999444555',
            correo: CORREO_AUTH_ERR,
            contrasena: passwordHash,
            biografia: null,
        });
    });

    afterAll(async () => {
        await pool.query('DELETE FROM voluntario WHERE correo = $1', [CORREO_AUTH_ERR]);
        await pool.end();
    });

    it('bcrypt NO valida una contraseña vacía', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_ERR);
        const passwordValida = await bcrypt.compare('', encontrado.contrasena);
        expect(passwordValida).toBe(false);
    });

    it('bcrypt NO valida una contraseña con mayúsculas cambiadas', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_ERR);
        const passwordValida = await bcrypt.compare('Password123', encontrado.contrasena);
        expect(passwordValida).toBe(false);
    });

    it('bcrypt NO valida una contraseña con espacios extra', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_ERR);
        const passwordValida = await bcrypt.compare(' password123 ', encontrado.contrasena);
        expect(passwordValida).toBe(false);
    });

    it('bcrypt NO valida una contraseña con un carácter diferente', async () => {
        const encontrado = await buscarVoluntarioPorCorreo(CORREO_AUTH_ERR);
        const passwordValida = await bcrypt.compare('password124', encontrado.contrasena);
        expect(passwordValida).toBe(false);
    });

    it('buscarVoluntarioPorCorreo devuelve null para un correo que no existe', async () => {
        const encontrado = await buscarVoluntarioPorCorreo('noexiste-12345@volunmatch.test');
        expect(encontrado).toBeNull();
    });
});