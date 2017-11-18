import auth from '../../SpoAuth';
import { ContextInfo } from '../../spo';
import config from '../../../../config';
import * as request from 'request-promise-native';
import commands from '../../commands';
import VerboseOption from '../../../../VerboseOption';
import Command, {
  CommandAction,
  CommandHelp,
  CommandOption,
  CommandValidate
} from '../../../../Command';
import appInsights from '../../../../appInsights';
import { RestResponse } from '../../models/RestResponse';
import { AppMetadata } from '../../models/AppMetadata';

const vorpal: Vorpal = require('../../../../vorpal-init');

interface CommandArgs {
  options: Options;
}

interface Options extends VerboseOption {
  type: string;
}

class AppListCommand extends Command {
  public get name(): string {
    return commands.TENANT_APP_LIST;
  }

  public get description(): string {
    return 'Retrieves the apps from the tenant app catalog';
  }

  public get action(): CommandAction {
    return function (args: CommandArgs, cb: () => void) {
      const verbose: boolean = args.options.verbose || false;

      appInsights.trackEvent({
        name: commands.TENANT_APP_LIST,
        properties: {
          verbose: verbose.toString()
        }
      });

      if (!auth.site.connected) {
        this.log('Connect to a SharePoint Online tenant admin site first');
        cb();
        return;
      }

      if (!auth.site.isTenantAdminSite()) {
        this.log(`${auth.site.url} is not a tenant admin site. Connect to your tenant admin site and try again`);
        cb();
        return;
      }

      auth
        .ensureAccessToken(auth.service.resource, this, verbose)
        .then((accessToken: string): Promise<ContextInfo> => {
          if (verbose) {
            this.log(`Retrieved access token ${accessToken}. Loading CDN settings for the ${auth.site.url} tenant...`);
          }

          const requestOptions: any = {
            url: `${auth.site.url}/_api/contextinfo`,
            headers: {
              authorization: `Bearer ${accessToken}`,
              accept: 'application/json;odata=nometadata'
            },
            json: true
          }

          if (verbose) {
            this.log('Executing web request...');
            this.log(requestOptions);
            this.log('');
          }

          return request.post(requestOptions);
        })
        .then((res: ContextInfo): Promise<string> => {
          if (verbose) {
            this.log('Response:');
            this.log(res);
            this.log('');
          }

          this.log(`Retrieving apps...`);

          const requestOptions: any = {
            url: `${auth.site.url}/_api/web/appcatalog/getavailable`,
            headers: {
              authorization: `Bearer ${auth.service.accessToken}`,
              accept: 'application/json',
              'X-RequestDigest': res.FormDigestValue
            },
            body: ``
          };

          if (verbose) {
            this.log('Executing web request...');
            this.log(requestOptions);
            this.log('');
          }

          return request.get(requestOptions);
        })
        .then((res: string): void => {
          if (verbose) {
            this.log('Response:');
            this.log(res);
            this.log('');
          }

          const json: RestResponse<AppMetadata> = JSON.parse(res);
                   
          const apps = json.d.results;    

          for(let app of apps)
          {
            this.log(`${app.Title}\t${app.Id}`)
          }
          cb();
        }, (err: any): void => {
          this.log(vorpal.chalk.red(`Error: ${err}`));
          cb();
        });
    };
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [];

    const parentOptions: CommandOption[] | undefined = super.options();
    if (parentOptions) {
      return options.concat(parentOptions);
    }
    else {
      return options;
    }
  }

  public validate(): CommandValidate {
    return (args: CommandArgs): boolean | string => {
      return true;
    };
  }

  public help(): CommandHelp {
    return function (args: CommandArgs, log: (help: string) => void): void {
      const chalk = vorpal.chalk;
      log(vorpal.find(commands.TENANT_APP_LIST).helpInformation());
      log(
        `  ${chalk.yellow('Important:')} before using this command, connect to a SharePoint Online tenant admin site,
  using the ${chalk.blue(commands.CONNECT)} command.
   
  Examples:
  
    ${chalk.grey(config.delimiter)} ${commands.TENANT_APP_LIST}
      Returns the URL of the current appcatalog for the tenant.

`);
    };
  }
}

module.exports = new AppListCommand();