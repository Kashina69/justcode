import { describe, it, expect } from 'vitest';
import { routeByTaskDescription, routeModelAlias } from '../../src/agent/router.js';
describe('router', () => {
    describe('routeByTaskDescription', () => {
        it('should route to fast if isReadOnly context is set', () => {
            expect(routeByTaskDescription('refactor my code', { isReadOnly: true })).toBe('fast');
            expect(routeByTaskDescription('/plan code change', { isReadOnly: true })).toBe('fast');
        });
        it('should route to planner for planning or explicit complex tasks', () => {
            expect(routeByTaskDescription('create a plan for auth')).toBe('planner');
            expect(routeByTaskDescription('/plan auth')).toBe('planner');
            expect(routeByTaskDescription('some task', { isComplex: true })).toBe('planner');
        });
        it('should route to smart for design/refactoring tasks', () => {
            expect(routeByTaskDescription('refactor the class structure')).toBe('smart');
            expect(routeByTaskDescription('design database tables')).toBe('smart');
            expect(routeByTaskDescription('optimize performance of loop')).toBe('smart');
        });
        it('should route to fast if active plans exist and no complex task keywords are matched', () => {
            expect(routeByTaskDescription('implement user login', { hasActivePlans: true })).toBe('fast');
        });
        it('should route to fast for short or simple queries', () => {
            expect(routeByTaskDescription('hello')).toBe('fast');
            expect(routeByTaskDescription('what is 2+2?')).toBe('fast');
            expect(routeByTaskDescription('where is index.ts')).toBe('fast');
        });
        it('should default to smart for regular queries', () => {
            expect(routeByTaskDescription('add a new parameter to register function')).toBe('smart');
        });
    });
    describe('routeModelAlias', () => {
        it('should correctly parse last user message and route', () => {
            const messages = [
                { role: 'user', content: 'hello' },
                { role: 'assistant', content: 'hi' },
                { role: 'user', content: 'refactor the server setup' },
            ];
            expect(routeModelAlias(messages, false)).toBe('smart');
        });
    });
});
