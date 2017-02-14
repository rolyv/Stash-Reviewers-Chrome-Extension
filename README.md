Bitbucket Server Reviewers Groups - Extension
==================

<p align="center">
<img src="https://raw.githubusercontent.com/rolyv/Stash-Reviewers-Chrome-Extension/master/docs/launch.png" alt="extension art" />
</p>

This chrome extension allow to define groups of reviewers in Atlassian Bitbucket Server (previously stash) to bulk add them when creating or updating pull request.

### Features

* Add button in pull request creation page to add group of reviewers
* Add comments notification icon in header toolbar
    * Comments are from unreviewed pull requests (PR you see in your inbox)
    * A row always represent the first comment of a hierarchy
    * Sub-comments/tasks are represented by the icon on the right of the row
    * Each time there is a new comment/task the line of the first message of the hierarchy is highlighted and the red badge of the notification icon is increased (on each page load. there is no ajax poll request)
    * Badge disappear after you click on the icon to open the panel and close it
    * Highlight disappear when you visit the related PR page
    * Highlight state is save on the localStorage
    * Note: there is 2 kind of highlight: strong blue is when you see it for the first time (open panel for the first time), light blue is when activity was already there when you opened panel previously.
* Add filter to the PR list
    * filter by: Author, Reviewers, Participants (people who participate to the PR even if they are not reviewers), Approvers (PR approved by specific reviewers), Direction, Branch
    * Note: each filter is a AND per PR and not a OR.
    * It mean that you can add only one Author or you will get no result (since there is only one author by PR).
    * And ALL reviewers/participants/approvers must exist in the PR or it won't be display
* Add highlighted header to outdated file in pull request details page instead of the small sticker on the right to improve readability
* Add clickable branch text (origin and target) in the pull request details page to go to the corresponding repository easily
* Add a sticker on the right of the 'branch overview' page of a repository to list all pull requests comming from this branch (OPEN/MERGED/DECLINED)
    * Note: sticker are clickable to go directly to the corresponding pull request
* Add a link to start a jenkin build in one click on the pull request details page
    * Note: you can add your hipchat username into the config panel of the extension to receive build notification
* Add template button to PR editor
* Check for new version
* Settings
    * user can choose features to enable/disable inside extension option
    * user can choose to receive desktop notification only for comments on his PR, mention or answer.
    * user can map a repository name to a specific name to match his remote name in git

### Installation

#### Chrome
you can find this extension on chrome webstore here: https://chrome.google.com/webstore/detail/bitbucket-server-extensio/lobhfmcekdkhhijecpfcjajmlajgfjjk

OR from the code source of this repository:

- clone this repository
- Go to chrome settings->extensions (extension manager)
- Check the "Developer Mode" checkbox
- Click on "Load unpacked extension" button.
- From there choose the extension/chrome/src folder of this repository.

### Configuration

##### Enable/Disable features
just go to options panel and enable or disable features you want.

##### Configure reviewers groups
A "Stash" icon will appear on the top right corner of chrome window. Click on it. It will ask you to add a json to describe which group you want to create with which reviewers.

Json format is as follow :

```
{
  "first group name": ["first reviewer name or email"],
  "second group name": ["first reviewer name or email", "second reviewer name or email"]
}
```


##### Using centralized lists
If you want to share one list between more users. You need to upload .json file so it is accessible by everyone. Then you just add URL to `URL to json` field. There can be more sources. All lists from files and from JSON field are merged together. Remote lists are reloaded on launch and every 6 hours.

![GitHub Logo](/docs/add_urls.png)

After that when you will go to pull request creation page or update page a dropdown will appear after reviewers list with a list of groups you defined.

![GitHub Logo](/docs/add_group.png)

**Note**: the extension will make a Bitbucket Server API request to find reviewers. It will simply send the string you added in the reviewers array as search term. Normally if you add email or username as recommended, API should return only one user. You can also enter a name but in this case if the API return more than one user, only the first one will be added.
