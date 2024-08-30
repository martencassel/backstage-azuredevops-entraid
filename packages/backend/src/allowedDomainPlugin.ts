import { coreServices, createBackendModule, CreateBackendModuleOptions, BackendFeature, BackendModuleRegistrationPoints } from '@backstage/backend-plugin-api';
import { stringifyEntityRef, DEFAULT_NAMESPACE } from '@backstage/catalog-model';
import {
  authProvidersExtensionPoint,
  createOAuthProviderFactory,
} from '@backstage/plugin-auth-node';
import { microsoftAuthenticator } from '@backstage/plugin-auth-backend-module-microsoft-provider';
import { AuthProviderFactory } from '@backstage/plugin-auth-node';

export class DomainValidationError extends Error {
  constructor(userEmailDomain: string, allowedDomain: string) {
    super(`AllowedDomainPolicyPlugin: Login failed, '${userEmailDomain}' does not belong to the expected domain '${allowedDomain}'.`);
    this.name = 'DomainValidationError';
  }
}

// AllowedDomainPolicyPlugin is a class that implements the signInHandler method.
export class AllowedDomainPolicyPlugin {
  // plugin id
  public static readonly PLUGIN_ID = 'auth';

  // module id
  public static readonly MODULE_ID = 'entra-signin-resolver';

  // config path in the app-config.yaml
  private static readonly CONFIG_KEY = 'auth.allowedDomain';

  constructor() {
  }

  async signInHandler(info: any, ctx: any) {
    console.debug('AllowedDomainPolicyPlugin.signInHandler')
    console.debug(info, ctx);
    // Getting the user email from the profile
    const userEmail = info.profile.email;
    if (userEmail == '') {
      throw new Error('AllowedDomainPolicyPlugin: User email is empty. Ensure that the user profile contains an email address before using AllowedDomainPolicyPlugin.');
    }
    if (userEmail == null) {
      throw new Error('AllowedDomainPolicyPlugin: User email is null. Ensure that the user profile contains an email address before using AllowedDomainPolicyPlugin.');
    }
    if (userEmail.includes('@') == false) {
      throw new Error('AllowedDomainPolicyPlugin: Invalid email address in user profile. Ensure that the user profile contains a valid email address before using AllowedDomainPolicyPlugin.');
    }
    console.debug(`AllowedDomainPolicyPlugin: User email is '${userEmail}'`);

    // Parse domain from email
    const userEmailDomain = userEmail.split('@')[1];
    let profile = {
      email: userEmail
    }
    if (!userEmailDomain) {
      throw new Error('AllowedDomainPolicyPlugin: Invalid email address in user profile: ' + userEmail);
    }
    if (allowedDomainSingleton == 'undefined') {
      throw new Error('AllowedDomainPolicyPlugin: No allowed domain configured. Please set the AllowedDomain in the configuration for backstage.');
    }
    console.debug(`AllowedDomainPolicyPlugin: Allowed domain is set to '${allowedDomainSingleton}'. This domain will be used to validate user sign-ins.`);

    
    console.debug(`AllowedDomainPolicyPlugin: Validating user email domain '${userEmailDomain}' against the allowed domain '${allowedDomainSingleton}'.`);
    if (userEmailDomain !== allowedDomainSingleton) {
      throw new DomainValidationError(userEmailDomain, allowedDomainSingleton);
    }
    console.debug(`AllowedDomainPolicyPlugin: User email domain '${userEmailDomain}' matches the allowed domain '${allowedDomainSingleton}'.`);

    // Issue token
    console.debug('AllowedDomainPolicyPlugin: Issuing token for user');

    const [localPart, _] = profile.email.split('@');
    console.log(`AllowedDomainPolicyPlugin: Issuing token for user '${profile.email}'`);

    const userEntity = stringifyEntityRef({
      kind: 'User',
      name: localPart,
      namespace: DEFAULT_NAMESPACE,
    });
    let token = ctx.issueToken({
      claims: {
        sub: userEntity,    // Subject of the token
        ent: [userEntity],  // Entities associated with the token
      },
    })
    console.debug('AllowedDomainPolicyPlugin: Token issued successfully');
    console.debug(token);
    return token
  }
  public static getConfigKey(): string {
    return AllowedDomainPolicyPlugin.CONFIG_KEY;
  }
}

// Creates an new instance of the MicrosoftAuthenticator.
function createMicrosoftAuthenticator(signInHandler: any): AuthProviderFactory {
  const options = {
    authenticator: microsoftAuthenticator,
    signInResolver: signInHandler,
  };
  let provider: AuthProviderFactory = createOAuthProviderFactory(options);
  return provider;
}

// static instance
var allowedDomainSingleton: string = 'undefined';
export var authPluginSingleton: AllowedDomainPolicyPlugin = new AllowedDomainPolicyPlugin()

export function createPlugin(): BackendFeature {
  console.debug('backend.main: Registering AllowedDomainPolicyPlugin');

  // Backend module options
  let options: CreateBackendModuleOptions = {

    // This ID must be exactly "auth" because that's the plugin it targets
    pluginId: AllowedDomainPolicyPlugin.PLUGIN_ID,

    // This ID must be unique, but can be anything.
    moduleId: AllowedDomainPolicyPlugin.MODULE_ID,

    // register function
    register(reg: BackendModuleRegistrationPoints) {
      let options = {
        deps: {
          httpRouter: coreServices.httpRouter,
          providers: authProvidersExtensionPoint,
          config: coreServices.rootConfig
        },
        // init function, called when the backend is starting up
        async init({ providers, config }: { providers: any, config: any }) {
          if (config == null) {
            throw new Error('AllowedDomainPolicyPlugin: Missing configuration object. Ensure that the configuration is initialized with the required settings, such as AllowedDomain, before using AllowedDomainPolicyPlugin.');
          }

          let allowedDomainConfig = config.getOptionalString(AllowedDomainPolicyPlugin.getConfigKey())
          allowedDomainSingleton = allowedDomainConfig;

          if (authPluginSingleton == null) {
            throw new Error('AllowedDomainPolicyPlugin instance is null');
          }
          console.debug('backend.main: Registering signInHandler in AllowedDomainPolicyPlugin');
          let msAuthenticator: AuthProviderFactory = createMicrosoftAuthenticator(authPluginSingleton.signInHandler);
          let regOptions = {
            providerId: 'microsoft',
            factory: msAuthenticator
          };
          console.debug('Registering custom auth provider');
          providers.registerProvider(regOptions)
        }
      }
      reg.registerInit(options);
    }
  }
  const module: BackendFeature = createBackendModule(options)
  return module;
}


