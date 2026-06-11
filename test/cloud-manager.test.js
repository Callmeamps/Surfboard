/**
 * Tests for cloud-manager.js
 * Tests GitHub Codespaces device code flow and workspace management.
 */

// Mock electron net
jest.mock('electron', () => ({
  net: {
    request: jest.fn(),
  },
  app: {
    getPath: () => __dirname,
  },
}));

// Mock profiles
jest.mock('../src/main/profiles', () => {
  let _profile = {};
  return {
    getCurrentProfile: jest.fn(() => _profile),
    updateCurrentProfile: jest.fn((patch) => { Object.assign(_profile, patch); }),
    _setProfile: (p) => { _profile = p; },
  };
});

const { net } = require('electron');
const profiles = require('../src/main/profiles');
const cloudManager = require('../src/main/cloud-manager');

function mockRequest(responseBody, statusCode = 200) {
  const mockReq = {
    on: jest.fn((event, cb) => {
      if (event === 'response') {
        cb({
          statusCode,
          on: jest.fn((event, cb2) => {
            if (event === 'data') cb2(Buffer.from(JSON.stringify(responseBody)));
            if (event === 'end') cb2();
          }),
        });
      }
    }),
    write: jest.fn(),
    end: jest.fn(),
  };
  net.request.mockReturnValue(mockReq);
  return mockReq;
}

beforeEach(() => {
  jest.clearAllMocks();
  profiles._setProfile({});
});

describe('cloud-manager', () => {
  describe('isConnected', () => {
    it('returns false when no token stored', () => {
      expect(cloudManager.isConnected('github')).toBe(false);
    });

    it('returns true when token exists', () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      expect(cloudManager.isConnected('github')).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('clears stored token', () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      const result = cloudManager.disconnect('github');
      expect(result.ok).toBe(true);
      expect(profiles.updateCurrentProfile).toHaveBeenCalledWith({ cloud_github_token: null });
    });
  });

  describe('startDeviceCodeFlow', () => {
    it('returns device code info from GitHub', async () => {
      mockRequest({
        device_code: 'dc-abc123',
        user_code: 'ABC1-DEF2',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      });

      const result = await cloudManager.startDeviceCodeFlow();

      expect(result).toEqual({
        deviceCode: 'dc-abc123',
        userCode: 'ABC1-DEF2',
        verificationUri: 'https://github.com/login/device',
        expiresIn: 900,
        interval: 5,
      });
    });

    it('throws on error response', async () => {
      mockRequest({ error: 'slow_down', error_description: 'Slow down' });

      await expect(cloudManager.startDeviceCodeFlow()).rejects.toThrow('Slow down');
    });
  });

  describe('pollForToken', () => {
    it('returns token when authorized', async () => {
      mockRequest({
        access_token: 'ghp_authorized123',
        scope: 'codespace',
        token_type: 'bearer',
      });

      const result = await cloudManager.pollForToken('dc-abc123');

      expect(result).toEqual({
        token: 'ghp_authorized123',
        scope: 'codespace',
      });
      // Token should be saved
      expect(profiles.updateCurrentProfile).toHaveBeenCalledWith(
        expect.objectContaining({ cloud_github_token: 'ghp_authorized123' })
      );
    });

    it('returns pending when not yet authorized', async () => {
      mockRequest({ error: 'authorization_pending' });

      const result = await cloudManager.pollForToken('dc-abc123');

      expect(result).toEqual({ pending: true });
    });

    it('returns retryAfter on slow_down', async () => {
      mockRequest({ error: 'slow_down', interval: 10 });

      const result = await cloudManager.pollForToken('dc-abc123');

      expect(result).toEqual({ pending: true, retryAfter: 10000 });
    });

    it('throws on expired token', async () => {
      mockRequest({ error: 'expired_token' });

      await expect(cloudManager.pollForToken('dc-abc123')).rejects.toThrow('expired');
    });

    it('throws on access denied', async () => {
      mockRequest({ error: 'access_denied' });

      await expect(cloudManager.pollForToken('dc-abc123')).rejects.toThrow('denied');
    });
  });

  describe('listCodespaces', () => {
    it('returns formatted codespace list', async () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      mockRequest({
        codespaces: [
          {
            name: 'my-codespace',
            display_name: 'My Codespace',
            state: 'Running',
            owner: { login: 'testuser' },
            repository: { full_name: 'testuser/repo' },
            machine_type: 'standardLinux',
            created_at: '2026-01-01T00:00:00Z',
            last_used_at: '2026-06-11T12:00:00Z',
            region: 'East US',
            git_status: { ref: 'main', has_uncommitted_changes: false, has_unpushed_changes: true },
          },
        ],
      });

      const result = await cloudManager.listCodespaces();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        name: 'my-codespace',
        displayName: 'My Codespace',
        state: 'Running',
        owner: 'testuser',
        repository: 'testuser/repo',
        machineType: 'standardLinux',
        region: 'East US',
      });
      expect(result[0].gitStatus.ref).toBe('main');
      expect(result[0].gitStatus.hasUnpushedChanges).toBe(true);
    });

    it('throws when not authenticated', async () => {
      await expect(cloudManager.listCodespaces()).rejects.toThrow('Not authenticated');
    });

    it('throws on API error', async () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      mockRequest({ message: 'Bad credentials' }, 401);

      await expect(cloudManager.listCodespaces()).rejects.toThrow('Bad credentials');
    });
  });

  describe('startCodespace', () => {
    it('sends start request', async () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      mockRequest({ state: 'Starting' });

      const result = await cloudManager.startCodespace('my-codespace');

      expect(result).toEqual({ ok: true, state: 'Starting' });
      expect(net.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'POST',
        url: expect.stringContaining('/start'),
      }));
    });
  });

  describe('stopCodespace', () => {
    it('sends stop request', async () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      mockRequest({ state: 'Shutdown' });

      const result = await cloudManager.stopCodespace('my-codespace');

      expect(result).toEqual({ ok: true, state: 'Shutdown' });
    });
  });

  describe('deleteCodespace', () => {
    it('sends delete request', async () => {
      profiles._setProfile({ cloud_github_token: 'ghp_test123' });
      mockRequest({}, 204);

      const result = await cloudManager.deleteCodespace('my-codespace');

      expect(result.ok).toBe(true);
      expect(net.request).toHaveBeenCalledWith(expect.objectContaining({
        method: 'DELETE',
      }));
    });
  });
});
