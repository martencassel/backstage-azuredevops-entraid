import { DEFAULT_NAMESPACE, stringifyEntityRef } from '@backstage/catalog-model';
import { createPlugin, authPluginSingleton, AllowedDomainPolicyPlugin, DomainValidationError } from '../src/allowedDomainPlugin';

describe('AllowedDomainPolicyPlugin', () => {
  let allowedDomainPlugin: AllowedDomainPolicyPlugin;
  let plugin;
  let mockCtx: any;
  let mockProfileBad: any;
  let mockProfileGood: any;
  let mockIssueToken: jest.Mock;

  beforeEach(() => {
    plugin = createPlugin();
    allowedDomainPlugin = authPluginSingleton
    mockCtx = {
      logger: {
        debug: jest.fn(),
      },
    };
    mockProfileGood = {
      email: 'wendy@windfloor.microsoft.com'
    };
    mockProfileBad = {
      email: 'lisa@contoso.microsoft.com'
    };
    mockIssueToken = jest.fn();
  })

  it('should not throw an error if users email domain matches the allowed domain', () => {
    process.env.AUTH_ALLOWED_DOMAIN = 'contoso.microsoft.com';
    expect(() => allowedDomainPlugin.signInHandler(mockProfileGood, mockCtx)).not.toThrow();
  })

  it('should throw an error if users email domain does not match the allowed domain', () => {
    process.env.AUTH_ALLOWED_DOMAIN = 'contoso.microsoft.com';
    expect(() => allowedDomainPlugin.signInHandler(mockProfileBad, mockCtx)).toThrow(DomainValidationError);
  })

})
